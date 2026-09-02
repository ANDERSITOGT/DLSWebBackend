import { Router, Response } from "express";
import multer from "multer";
import OpenAI from "openai";
import sharp from "sharp";
import prisma from "../prisma";
import { authenticateToken, AuthRequest } from "../middlewares/auth";
import { movimientosService } from "../services/movimientosService";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = ["image/jpeg", "image/png"];

    if (tiposPermitidos.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error("Solo se permiten imágenes en formato PNG o JPG para el escaneo."));
  },
});
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});
const openAiModel = process.env.OPENAI_MODEL || "gpt-4o";

// ---------------------------------------------------------------------
// FUNCIÓN AUXILIAR: CALCULAR MODA
// ---------------------------------------------------------------------
function calcularModa(precios: number[]): number {
  if (precios.length === 0) return 0;
  
  const frecuencia: Record<string, number> = {};
  let maxFrecuencia = 0;
  let moda = precios[0];

  for (const p of precios) {
    const key = p.toString();
    frecuencia[key] = (frecuencia[key] || 0) + 1;
    
    if (frecuencia[key] > maxFrecuencia) {
      maxFrecuencia = frecuencia[key];
      moda = p;
    }
  }
  return moda;
}

function normalizarNit(valor?: string | null): string {
  return (valor ?? "").toString().replace(/[^0-9]/g, "");
}

function distanciaLevenshtein(a: string, b: string): number {
  const filaInicial = Array.from({ length: b.length + 1 }, (_, indice) => indice);
  let filaAnterior = filaInicial;

  for (let indiceA = 1; indiceA <= a.length; indiceA++) {
    const filaActual = [indiceA];
    for (let indiceB = 1; indiceB <= b.length; indiceB++) {
      const costo = a[indiceA - 1] === b[indiceB - 1] ? 0 : 1;
      filaActual[indiceB] = Math.min(
        filaActual[indiceB - 1] + 1,
        filaAnterior[indiceB] + 1,
        filaAnterior[indiceB - 1] + costo,
      );
    }
    filaAnterior = filaActual;
  }

  return filaAnterior[b.length];
}

// ==========================================
// POST /api/movimientos/ingreso
// ==========================================
router.post("/ingreso", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { bodegaId, proveedorId, fecha, tipoComprobante, factura, serie, uuid, observaciones, items } = req.body;
    if (!bodegaId || !items || items.length === 0) return res.status(400).json({ message: "Faltan datos obligatorios." });
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ message: "Error de identidad." });

    const resultado = await prisma.$transaction(async (tx) => {
      const anioActual = new Date().getFullYear();
      let nuevoCorrelativo = 1;
      const contador = await tx.consecutivo.findUnique({ where: { tipo_anio: { tipo: "INGRESO", anio: anioActual } } });
      if (contador) {
          const actualizado = await tx.consecutivo.update({ where: { id: contador.id }, data: { ultimo: { increment: 1 } } });
          nuevoCorrelativo = actualizado.ultimo || 1;
      } else {
          await tx.consecutivo.create({ data: { tipo: "INGRESO", anio: anioActual, ultimo: 1, prefijo: "ING" } });
          nuevoCorrelativo = 1;
      }
      const codigoGenerado = `ING-${anioActual}-${nuevoCorrelativo.toString().padStart(4, '0')}`;
      const documento = await tx.documento.create({
        data: { tipo: "INGRESO", estado: "APROBADO", consecutivo: codigoGenerado, fecha: fecha ? new Date(fecha) : new Date(), bodegadestinoid: bodegaId, proveedorid: proveedorId || null, creadorid: userId, observacion: observaciones || "" },
      });
      if (proveedorId && factura) {
        const proveedorData = await tx.proveedor.findUnique({ where: { id: proveedorId } });
        await tx.comprobante_fiscal.create({ data: { documentoid: documento.id, tipocomprobante: tipoComprobante || "FACTURA", nitemisor: proveedorData?.nit || "CF", numero: factura, serie: serie || null, uuid: uuid || null, fechaemision: fecha ? new Date(fecha) : new Date() } });
      }
      for (const item of items) {
        const productoInfo = await tx.producto.findUnique({ where: { id: item.productoId } });
        if (!productoInfo) throw new Error(`Producto ${item.productoId} no encontrado`);
        await tx.documento_item.create({ data: { documentoid: documento.id, productoid: item.productoId, cantidad: item.cantidad, costounit: item.costo, unidadid: productoInfo.unidadid, loteid: item.loteId || null }, });
        const ultimosIngresos = await tx.documento_item.findMany({ where: { productoid: item.productoId, documento: { tipo: "INGRESO", estado: "APROBADO" } }, orderBy: { createdat: "desc" }, take: 10, select: { costounit: true } });
        const precios = ultimosIngresos.map(u => Number(u.costounit));
        if (precios.length === 0) precios.push(Number(item.costo));
        const nuevoPrecioRef = calcularModa(precios);
        await tx.producto.update({ where: { id: item.productoId }, data: { precioref: nuevoPrecioRef } });
      }
      return documento;
    }, { maxWait: 5000, timeout: 20000 });
    res.json({ ok: true, documento: resultado, message: "Ingreso registrado correctamente" });
  } catch (error: any) {
    console.error("Error al crear ingreso:", error);
    res.status(500).json({ message: "Error interno", error: error.message || error });
  }
});

// ==========================================
// POST /api/movimientos/ajuste
// ==========================================
router.post("/ajuste", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { productoId, cantidad, notas, tipo } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autorizado" });
    if (!productoId || !cantidad || !notas) return res.status(400).json({ message: "Faltan datos" });
    const userRole = req.user?.rol;
    if (userRole !== "ADMIN" && userRole !== "BODEGUERO") return res.status(403).json({ message: "No tienes permisos para realizar ajustes." });

    const resultado = await prisma.$transaction(async (tx) => {
        const anioActual = new Date().getFullYear();
        let nuevoCorrelativo = 1;
        const contador = await tx.consecutivo.findUnique({ where: { tipo_anio: { tipo: "AJUSTE", anio: anioActual } } });
        if (contador) {
             const actualizado = await tx.consecutivo.update({ where: { id: contador.id }, data: { ultimo: { increment: 1 } } });
             nuevoCorrelativo = actualizado.ultimo || 1;
        } else {
             await tx.consecutivo.create({ data: { tipo: "AJUSTE", anio: anioActual, ultimo: 1, prefijo: "AJU" } });
             nuevoCorrelativo = 1;
        }
        const codigoGenerado = `AJU-${anioActual}-${nuevoCorrelativo.toString().padStart(4, '0')}`;
        const bodegaDefault = await tx.bodega.findFirst();
        const documento = await tx.documento.create({ data: { tipo: "AJUSTE", estado: "APROBADO", consecutivo: codigoGenerado, fecha: new Date(), creadorid: userId, bodegaorigenid: bodegaDefault?.id, observacion: notas } });
        const prod = await tx.producto.findUnique({ where: { id: productoId } });
        if (!prod) throw new Error("Producto no encontrado");
        await tx.documento_item.create({ data: { documentoid: documento.id, productoid: productoId, unidadid: prod.unidadid, cantidad: Number(cantidad), notas: `Ajuste manual (${tipo})` } });
        return documento;
    });
    res.json({ ok: true, documento: resultado });
  } catch (error: any) {
    console.error("Error al crear ajuste:", error);
    res.status(500).json({ message: "Error al guardar ajuste", error: error.message });
  }
});

// ==========================================
// POST /api/movimientos/devolucion-proveedor
// ==========================================
router.post("/devolucion-proveedor", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { proveedorId, bodegaId, items, notas } = req.body;
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "No autorizado" });
      if (!proveedorId || !items || items.length === 0) return res.status(400).json({ message: "Faltan datos" });
      const userRole = req.user?.rol;
      if (userRole !== "ADMIN" && userRole !== "BODEGUERO") return res.status(403).json({ message: "No tienes permisos para devolver a proveedores." });
  
      const resultado = await prisma.$transaction(async (tx) => {
          const anioActual = new Date().getFullYear();
          let nuevoCorrelativo = 1;
          const contador = await tx.consecutivo.findUnique({ where: { tipo_anio: { tipo: "DEVOLUCION", anio: anioActual } } });
          if (contador) {
               const actualizado = await tx.consecutivo.update({ where: { id: contador.id }, data: { ultimo: { increment: 1 } } });
               nuevoCorrelativo = actualizado.ultimo || 1;
          } else {
               await tx.consecutivo.create({ data: { tipo: "DEVOLUCION", anio: anioActual, ultimo: 1, prefijo: "DEV" } });
               nuevoCorrelativo = 1;
          }
          const codigoGenerado = `DEV-${anioActual}-${nuevoCorrelativo.toString().padStart(4, '0')}`;
          const documento = await tx.documento.create({ data: { tipo: "DEVOLUCION", estado: "APROBADO", consecutivo: codigoGenerado, fecha: new Date(), creadorid: userId, bodegaorigenid: bodegaId, proveedorid: proveedorId, observacion: notas || "Devolución a proveedor" } });
          for (const item of items) {
              const prod = await tx.producto.findUnique({ where: { id: item.productoId } });
              if (!prod) throw new Error("Producto no encontrado");
              await tx.documento_item.create({ data: { documentoid: documento.id, productoid: item.productoId, unidadid: prod.unidadid, cantidad: Number(item.cantidad), notas: item.notas } });
          }
          return documento;
      });
      res.json({ ok: true, documento: resultado });
    } catch (error: any) {
      console.error("Error al devolver a proveedor:", error);
      res.status(500).json({ message: "Error al procesar devolución", error: error.message });
    }
  });


// ==========================================
// POST /api/movimientos/escanear
// ==========================================
router.post("/escanear", authenticateToken, upload.single("documento"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se recibió el archivo en el campo 'documento'." });
    }

    const mimePermitido = ["image/jpeg", "image/png"].includes(req.file.mimetype);
    if (!mimePermitido) {
      return res.status(400).json({ message: "Solo se permiten imágenes en formato PNG o JPG para el escaneo." });
    }

    const metadata = await sharp(req.file.buffer).metadata();
    const anchoOriginal = metadata.width ?? 0;
    const debeReducir = anchoOriginal > 2200;
    const imagenParaOpenAI = debeReducir
      ? await sharp(req.file.buffer)
        .resize({ width: 2200, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer()
      : req.file.buffer;
    const mimeType = debeReducir ? "image/jpeg" : req.file.mimetype;

    if (debeReducir) {
      const ahorroPorcentaje = ((1 - imagenParaOpenAI.length / req.file.buffer.length) * 100).toFixed(1);
      console.log(`[OCR] Imagen reducida de ${anchoOriginal}px: ${(req.file.buffer.length / 1024).toFixed(2)} KB -> ${(imagenParaOpenAI.length / 1024).toFixed(2)} KB (${ahorroPorcentaje}% ahorro)`);
    }

    const base64Data = imagenParaOpenAI.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    const completion = await openai.chat.completions.create({
      model: openAiModel,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "factura_ocr_result",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              serie: { type: ["string", "null"] },
              numero: { type: ["string", "null"] },
              fecha: { type: ["string", "null"] },
              proveedor: { type: ["string", "null"] },
              nit: { type: ["string", "null"] },
              tipo: { type: ["string", "null"] },
              observaciones: { type: ["string", "null"] },
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    descripcion: { type: ["string", "null"] },
                    cantidad: { type: ["number", "null"] },
                    precioUnitario: { type: ["number", "null"] },
                    subtotal: { type: ["number", "null"] },
                  },
                  required: ["descripcion", "cantidad", "precioUnitario", "subtotal"],
                },
              },
            },
            required: ["serie", "numero", "fecha", "proveedor", "nit", "tipo", "observaciones", "items"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Eres un extractor de documentos de facturas y recibos agrícolas. Lee la imagen con máxima precisión. Devuelve SOLO un JSON válido que cumpla exactamente el esquema indicado. No escribas texto adicional, ni markdown, ni explicaciones. Si un valor no se ve claramente, usa null. No inventes datos. IMPORTANTE: NO recalcules los subtotales ni inventes matemáticas. Extrae EXACTAMENTE los dígitos impresos en el papel, carácter por carácter. Los precios tienen formato de moneda con 'Q' y comas para miles (ej. 'Q 1,274.36'). Elimina la 'Q' y TODAS las comas antes de generar el JSON (debe ser el número 1274.36). NUNCA trunques los decimales ni los miles. Lee la tabla de productos de forma estrictamente horizontal fila por fila para no mezclar precios. Hay mucho espacio en blanco entre la descripción y los precios. Guíate estrictamente por las columnas: La primera columna a la izquierda es CANTIDAD. La penúltima columna es PRECIO UNITARIO. La última columna a la derecha es VALOR (subtotal). Para cada fila, toma cantidad, descripcion, precioUnitario y subtotal de la misma línea visual. IMPORTANTE - MANEJO DE DISTORSIONES: La imagen puede estar tomada en ángulo, el papel puede estar doblado o tener marcas de agua gigantes (como la palabra 'COPIA' en rojo cruzando la tabla). IGNORA por completo cualquier marca de agua o sello sobrepuesto. Sigue la alineación de las filas con extrema precaución. Traza una línea horizontal imaginaria desde la descripción del producto hasta su precio exacto, compensando cualquier inclinación de la foto. Asegúrate de extraer TODAS las filas. No omitas el último producto de la lista, aunque sea WINNER LT. Extrae el NIT del emisor, no el NIT del cliente. Para proveedor y descripcion, conserva el texto tal como aparece en la factura. Para cantidad, precioUnitario y subtotal usa números reales, no strings. Mantén el orden de los items según la factura.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analiza la factura o recibo adjunto con atención a las columnas y al orden de las filas. Lee primero la cabecera para obtener proveedor, NIT del emisor, numero, serie y fecha. Luego extrae los items en el mismo orden en que aparecen en la factura. IMPORTANTE: copia el NIT exacto sin añadir números extra. Los precios tienen formato de moneda con 'Q' y comas para miles (ej. 'Q 1,274.36'). Elimina la 'Q' y TODAS las comas antes de generar el JSON (debe ser el número 1274.36). NUNCA trunques los decimales ni los miles. Hay mucho espacio en blanco entre la descripción y los precios. Guíate estrictamente por las columnas: la primera columna a la izquierda es CANTIDAD, la penúltima es PRECIO UNITARIO y la última a la derecha es VALOR (subtotal). Para la tabla de items, no inventes ceros ni corrijas los valores totales. No recalcules cantidades, precios ni subtotales. Lee cada fila horizontalmente y asocia únicamente los cuatro valores de esa misma línea visual. Mantén los nombres exactos de los productos y del proveedor tal como aparecen en la factura; no los reordenes ni los cambies. Si no se ve claramente un campo, usa null. Devuelve SOLO este JSON exacto: { \"serie\": \"string o null\", \"numero\": \"string o null\", \"fecha\": \"YYYY-MM-DD o null\", \"proveedor\": \"string o null\", \"nit\": \"string o null\", \"tipo\": \"factura\" o \"recibo\" o null, \"observaciones\": \"string o null\", \"items\": [{ \"descripcion\": \"string o null\", \"cantidad\": 0, \"precioUnitario\": 0, \"subtotal\": 0 }] }."
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      return res.status(500).json({ message: "La IA no devolvió contenido." });
    }

    const repararJsonOpenAI = (texto: string) => {
      let limpio = texto.trim();
      limpio = limpio.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

      const inicio = limpio.indexOf("{");
      const fin = limpio.lastIndexOf("}");
      if (inicio !== -1 && fin !== -1 && fin > inicio) {
        limpio = limpio.slice(inicio, fin + 1);
      }

      limpio = limpio.replace(/,\s*([}\]])/g, "$1");
      limpio = limpio.replace(/([{,]\s*)([A-Za-z0-9_]+)(\s*:)/g, '$1"$2"$3');

      return limpio;
    };

    console.log("OpenAI raw response:", rawResponse);

    let datosExtraidos;
    try {
      datosExtraidos = JSON.parse(repararJsonOpenAI(rawResponse));
      console.log("OpenAI parsed JSON:", JSON.stringify(datosExtraidos, null, 2));
    } catch (parseError: any) {
      console.error("Error parseando JSON recibido de OpenAI:", rawResponse);
      return res.status(500).json({
        message: "La IA devolvió un formato inválido.",
        error: parseError.message,
        raw: rawResponse,
      });
    }

    const normalizarTextoBusqueda = (valor?: string | null) =>
      (valor ?? "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .replace(/\b(kg|kilos|kilogramo|kilogramo|l|lt|lts|litros|litro|ml|gr|g|gramos|gramo|saco|sacos|bolsa|bolsas|frasco|frascos|rollo|rollos|unidad|unidades)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    const calcularCoincidencia = (textoOriginal: string, textoCatalogo: string) => {
      const a = normalizarTextoBusqueda(textoOriginal);
      const b = normalizarTextoBusqueda(textoCatalogo);

      if (!a || !b) return 0;
      if (a === b) return 100;

      const tokensA = new Set(a.split(" ").filter(Boolean));
      const tokensB = new Set(b.split(" ").filter(Boolean));
      const interseccion = [...tokensA].filter((token) => tokensB.has(token));
      const overlap = interseccion.length / Math.max(tokensA.size, tokensB.size || 1);
      return Math.round(overlap * 100);
    };

    let proveedorEncontrado: { id: string; nombre: string; nit?: string | null } | null = null;
    const proveedorTexto = String(datosExtraidos?.proveedor ?? "").trim();
    const nitExtraido = normalizarNit(datosExtraidos?.nit);

    const proveedoresCatalogo = await prisma.proveedor.findMany({
      select: { id: true, nombre: true, nit: true },
    });

    if (nitExtraido) {
      proveedorEncontrado = proveedoresCatalogo.find(
        (proveedor) => normalizarNit(proveedor.nit) === nitExtraido,
      ) ?? null;
    }

    if (!proveedorEncontrado && proveedorTexto) {
      const proveedoresOrdenados = proveedoresCatalogo
        .map((proveedor) => ({
          ...proveedor,
          score: calcularCoincidencia(proveedorTexto, proveedor.nombre),
        }))
        .sort((a, b) => b.score - a.score);
      const mejorProveedor = proveedoresOrdenados[0];
      const segundoProveedor = proveedoresOrdenados[1];

      if (mejorProveedor && mejorProveedor.score >= 70 &&
          (!segundoProveedor || mejorProveedor.score - segundoProveedor.score >= 10)) {
        proveedorEncontrado = {
          id: mejorProveedor.id,
          nombre: mejorProveedor.nombre,
          nit: mejorProveedor.nit,
        };
      }
    }

    console.log("🔎 [OCR] Resultado de búsqueda del proveedor:", {
      nitExtraido: nitExtraido || null,
      proveedorEncontrado: proveedorEncontrado
        ? { id: proveedorEncontrado.id, nombre: proveedorEncontrado.nombre, nit: proveedorEncontrado.nit }
        : null,
    });

    const itemsBase = Array.isArray(datosExtraidos?.items)
      ? datosExtraidos.items
      : [];

    const catalogoProductos = await prisma.producto.findMany({
      select: {
        id: true,
        nombre: true,
        codigo: true,
        precioref: true,
      },
    });

    const itemsConProducto = await Promise.all(
      itemsBase.map(async (item: any) => {
        const descripcion = String(item?.descripcion ?? "").trim();
        const cantidad = Number(item?.cantidad ?? 0);
        const precioUnitario = Number(item?.precioUnitario ?? 0);
        const subtotal = Number(item?.subtotal ?? 0);

        let productoCoincidente: { id: string; nombre: string; codigo: string; precioref: number | null } | null = null;

        if (descripcion) {
          const descripcionNormalizada = normalizarTextoBusqueda(descripcion);
          const productosOrdenados = catalogoProductos
            .map((producto) => {
              const nombreNormalizado = normalizarTextoBusqueda(producto.nombre);
              const distancia = distanciaLevenshtein(descripcionNormalizada, nombreNormalizado);
              const similitudLevenshtein = 1 - (distancia / Math.max(descripcionNormalizada.length, nombreNormalizado.length, 1));
              const similitudTokens = calcularCoincidencia(descripcion, producto.nombre) / 100;
              const score = Math.max(similitudLevenshtein, similitudTokens);

              return {
                ...producto,
                score,
                precioref: producto.precioref != null ? Number(producto.precioref) : null,
              };
            })
            .sort((a, b) => b.score - a.score);

          const mejorProducto = productosOrdenados[0];
          const segundoProducto = productosOrdenados[1];

            console.log("🔍 [Match Debug] Evaluando:", descripcion, "| Mejor candidato:", mejorProducto?.nombre, "| Score:", mejorProducto?.score);

              if (mejorProducto && mejorProducto.score >= 0.65 &&
                (!segundoProducto || mejorProducto.score - segundoProducto.score >= 0.03)) {
            productoCoincidente = {
              id: mejorProducto.id,
              nombre: mejorProducto.nombre,
              codigo: mejorProducto.codigo,
              precioref: mejorProducto.precioref,
            };
          }
        }

        return {
          descripcion,
          cantidad,
          precioUnitario,
          subtotal,
          productoId: productoCoincidente?.id ?? null,
          productoNombre: productoCoincidente?.nombre ?? null,
          productoCodigo: productoCoincidente?.codigo ?? null,
          precioBase: productoCoincidente?.precioref != null ? Number(productoCoincidente.precioref) : null,
          esLibre: !productoCoincidente,
        };
      })
    );

    const idsProductosEncontrados = itemsConProducto
      .filter((item) => item.productoId)
      .map((item) => ({ productoId: item.productoId, nombre: item.productoNombre }));

    console.log("🧩 [OCR] IDs de productos encontrados en base de datos:", idsProductosEncontrados);

    const payloadParaFrontend = {
      serie: datosExtraidos?.serie ?? null,
      numero: datosExtraidos?.numero ?? null,
      fecha: datosExtraidos?.fecha ?? null,
      nit: datosExtraidos?.nit ?? null,
      proveedor: datosExtraidos?.proveedor
        ? datosExtraidos.proveedor
        : (proveedorEncontrado
          ? { id: proveedorEncontrado.id, nombre: proveedorEncontrado.nombre, nit: proveedorEncontrado.nit ?? null }
          : null),
      proveedorId: proveedorEncontrado?.id ?? null,
      proveedorNombre: datosExtraidos?.proveedor ?? proveedorEncontrado?.nombre ?? null,
      tipo: datosExtraidos?.tipo ?? null,
      observaciones: datosExtraidos?.observaciones ?? null,
      items: itemsConProducto,
    };

    console.log("📤 [OCR] Payload final enviado al frontend:", JSON.stringify(payloadParaFrontend, null, 2));

    return res.json(payloadParaFrontend);
  } catch (error: any) {
    console.error("Error al escanear documento con OpenAI:", error);
    return res.status(500).json({
      message: "Error al escanear el documento.",
      error: error.message || error,
    });
  }
});

// ================================
// RUTAS DE LECTURA
// ================================

// 1. MOVIMIENTOS GENERALES
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const usuario = req.user ? { id: req.user.id, rol: req.user.rol } : undefined;
    const data = await movimientosService.getListadoMovimientos(usuario);
    res.json({ movimientos: data });
  } catch (error) {
    console.error("Error en GET /api/movimientos:", error);
    res.status(500).json({ message: "Error al obtener movimientos" });
  }
});

// 2. EXPORTAR MOVIMIENTOS
router.get("/export", async (req, res) => {
  try {
    const { filename, mime, content } = await movimientosService.exportListadoMovimientosPDF();
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    res.status(500).send("Error al exportar");
  }
});

// 3. DETALLE DE MOVIMIENTO
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const data = await movimientosService.getDetalleMovimiento(id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener detalle" });
  }
});

// 4. EXPORTAR DETALLE MOVIMIENTO
router.get("/:id/export", async (req, res) => {
  try {
    const id = req.params.id;
    const { filename, mime, content } = await movimientosService.exportMovimientoDetallePDF(id);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    res.status(500).send("Error al exportar detalle");
  }
});

export default router;