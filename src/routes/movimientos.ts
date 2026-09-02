import { Router, Response } from "express";
import multer from "multer";
import OpenAI from "openai";
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
const openAiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

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

function corregirCantidadDesdeSubtotal(item: any) {
  if (!item || typeof item !== "object") return item;

  const cantidadOriginal = Number(item?.cantidad ?? 0);
  const precioUnitario = Number(item?.precioUnitario ?? 0);
  const subtotal = Number(item?.subtotal ?? 0);

  if (!Number.isFinite(cantidadOriginal) || !Number.isFinite(precioUnitario) || !Number.isFinite(subtotal)) {
    return item;
  }

  if (precioUnitario <= 0 || subtotal <= 0) {
    return item;
  }

  const cantidadCalculada = subtotal / precioUnitario;
  const diferencia = Math.abs(cantidadCalculada - cantidadOriginal);
  const cantidadPareceSospechosa = cantidadOriginal <= 1 || diferencia > 0.5;

  if (!cantidadPareceSospechosa) {
    return item;
  }

  if (!Number.isFinite(cantidadCalculada) || cantidadCalculada <= 0) {
    return item;
  }

  const cantidadRedondeada = Math.round(cantidadCalculada);
  const diferenciaRedondeada = Math.abs(cantidadCalculada - cantidadRedondeada);

  if (cantidadRedondeada >= 1 && diferenciaRedondeada <= 0.05) {
    console.log("🧮 [OCR] Cantidad corregida por relación subtotal/precio:", {
      descripcion: item?.descripcion ?? "Sin descripción",
      cantidadOriginal,
      precioUnitario,
      subtotal,
      cantidadCalculada,
      cantidadRedondeada,
    });
    item.cantidad = cantidadRedondeada;
  }

  return item;
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

    // Mantener la imagen original para evitar pérdida de legibilidad en OCR, especialmente en facturas/recibos con texto pequeño.
    // Si luego quieres optimizar, conviene hacerlo con un resize muy ligero y sin reducir demasiado la calidad.
    const base64Data = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype === "image/png" ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    const completion = await openai.chat.completions.create({
      model: openAiModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un experto en extracción de datos de facturas y recibos agrícolas. Devuelve únicamente un objeto JSON válido con la estructura exacta que te indico. Si no existe un dato, usa null. No escribas texto adicional, ni Markdown, ni explicaciones.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analiza la imagen adjunta y devuelve EXACTAMENTE este objeto JSON: { \"serie\": \"string\", \"numero\": \"string\", \"fecha\": \"YYYY-MM-DD\", \"proveedor\": \"Nombre del proveedor o emisor\", \"tipo\": \"factura\" o \"recibo\", \"observaciones\": \"string\", \"items\": [ { \"descripcion\": \"Nombre del producto agrícola\", \"cantidad\": 0, \"precioUnitario\": 0, \"subtotal\": 0 } ] }. Asegúrate de devolver un JSON válido, no texto libre."
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 1500,
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      return res.status(500).json({ message: "La IA no devolvió contenido." });
    }

    console.log("OpenAI raw response:", rawResponse);

    let datosExtraidos;
    try {
      datosExtraidos = JSON.parse(rawResponse);
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
        .replace(/\b\d+(?:[.,]\d+)?\b/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    const calcularCoincidencia = (textoOriginal: string, textoCatalogo: string) => {
      const a = normalizarTextoBusqueda(textoOriginal);
      const b = normalizarTextoBusqueda(textoCatalogo);

      if (!a || !b) return 0;
      if (a === b) return 100;
      if (a.includes(b) || b.includes(a)) return 90;

      const tokensA = new Set(a.split(" ").filter(Boolean));
      const tokensB = new Set(b.split(" ").filter(Boolean));
      const interseccion = [...tokensA].filter((token) => tokensB.has(token));
      const overlap = interseccion.length / Math.max(tokensA.size, tokensB.size || 1);
      return Math.round(overlap * 100);
    };

    let proveedorEncontrado: { id: string; nombre: string; nit?: string | null } | null = null;
    const proveedorTexto = String(datosExtraidos?.proveedor ?? "").trim();

    if (proveedorTexto) {
      const proveedoresCoincidentes = await prisma.proveedor.findMany({
        where: {
          nombre: { contains: proveedorTexto, mode: "insensitive" },
        },
        select: { id: true, nombre: true, nit: true },
        take: 10,
      });

      if (proveedoresCoincidentes.length > 0) {
        proveedorEncontrado = proveedoresCoincidentes
          .map((proveedor) => ({
            ...proveedor,
            score: calcularCoincidencia(proveedorTexto, proveedor.nombre),
          }))
          .sort((a, b) => b.score - a.score)[0];
      }

      if (!proveedorEncontrado) {
        const proveedoresCatalogo = await prisma.proveedor.findMany({
          select: { id: true, nombre: true, nit: true },
          take: 100,
        });

        const mejorProveedor = proveedoresCatalogo
          .map((proveedor) => ({
            ...proveedor,
            score: calcularCoincidencia(proveedorTexto, proveedor.nombre),
          }))
          .sort((a, b) => b.score - a.score)[0];

        if (mejorProveedor && mejorProveedor.score >= 35) {
          proveedorEncontrado = {
            id: mejorProveedor.id,
            nombre: mejorProveedor.nombre,
            nit: mejorProveedor.nit,
          };
        }
      }

      console.log("🔎 [OCR] Resultado de búsqueda del proveedor:", proveedorEncontrado
        ? { id: proveedorEncontrado.id, nombre: proveedorEncontrado.nombre, nit: proveedorEncontrado.nit }
        : null);
    }

    const itemsBase = Array.isArray(datosExtraidos?.items)
      ? datosExtraidos.items.map((item: any) => corregirCantidadDesdeSubtotal(item))
      : [];

    const itemsConProducto = await Promise.all(
      itemsBase.map(async (item: any) => {
        const descripcion = String(item?.descripcion ?? "").trim();
        const cantidad = Number(item?.cantidad ?? 0);
        const precioUnitario = Number(item?.precioUnitario ?? 0);
        const subtotal = Number(item?.subtotal ?? 0);

        let productoCoincidente: { id: string; nombre: string; codigo: string; precioref: number | null } | null = null;

        if (descripcion) {
          const productosCoincidentes = await prisma.producto.findMany({
            where: {
              OR: [
                { nombre: { contains: descripcion, mode: "insensitive" } },
                { codigo: { contains: descripcion, mode: "insensitive" } },
              ],
            },
            select: {
              id: true,
              nombre: true,
              codigo: true,
              precioref: true,
            },
            take: 10,
          });

          if (productosCoincidentes.length > 0) {
            const mejorProducto = productosCoincidentes
              .map((producto) => ({
                ...producto,
                score: calcularCoincidencia(descripcion, producto.nombre),
                precioref: producto.precioref != null ? Number(producto.precioref) : null,
              }))
              .sort((a, b) => b.score - a.score)[0];

            if (mejorProducto) {
              productoCoincidente = {
                id: mejorProducto.id,
                nombre: mejorProducto.nombre,
                codigo: mejorProducto.codigo,
                precioref: mejorProducto.precioref,
              };
            }
          }

          if (!productoCoincidente) {
            const catalogoProductos = await prisma.producto.findMany({
              select: {
                id: true,
                nombre: true,
                codigo: true,
                precioref: true,
              },
              take: 200,
            });

            const mejorProducto = catalogoProductos
              .map((producto) => ({
                ...producto,
                score: calcularCoincidencia(descripcion, producto.nombre),
                precioref: producto.precioref != null ? Number(producto.precioref) : null,
              }))
              .sort((a, b) => b.score - a.score)[0];

            if (mejorProducto && mejorProducto.score >= 35) {
              productoCoincidente = {
                id: mejorProducto.id,
                nombre: mejorProducto.nombre,
                codigo: mejorProducto.codigo,
                precioref: mejorProducto.precioref,
              };
            }
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
      proveedor: proveedorEncontrado
        ? { id: proveedorEncontrado.id, nombre: proveedorEncontrado.nombre, nit: proveedorEncontrado.nit ?? null }
        : (datosExtraidos?.proveedor ?? null),
      proveedorId: proveedorEncontrado?.id ?? null,
      proveedorNombre: proveedorEncontrado?.nombre ?? datosExtraidos?.proveedor ?? null,
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