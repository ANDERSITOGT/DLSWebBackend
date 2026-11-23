import prisma from "../../core/prisma";
import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";

// =============================
// Error de negocio tipado
// =============================
/**
 * Error controlado del dominio de movimientos.
 * Permite que la capa HTTP traduzca reglas de negocio a status codes
 * (400 / 404 / 409) en lugar de devolver siempre 500.
 */
export class MovimientoError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public codigo?: string
  ) {
    super(message);
    this.name = "MovimientoError";
  }
}

// =============================
// Helper para construir PDFs
// =============================
async function buildPDF(build: (doc: any) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: any) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err: any) => reject(err));
    build(doc);
    doc.end();
  });
}

// =============================
// Tipos DTO para el frontend
// =============================
export type MovimientoTipo = "INGRESO" | "SALIDA" | "TRANSFERENCIA" | "AJUSTE" | "DEVOLUCION";
export type MovimientoEstado = "BORRADOR" | "APROBADO" | "ANULADO";

export type MovimientoResumenDTO = {
  id: string;
  codigo: string;
  tipo: MovimientoTipo;
  estado: MovimientoEstado;
  origen: string | null;
  destino: string | null;
  proveedor: string | null;
  productos: string;
  fecha: string | null;     
  createdat?: string;       
};

export type ProductoEnMovimientoDTO = {
  id: string;
  productoNombre: string;
  productoCodigo: string;
  cantidad: string;
  unidad: string;
  loteCodigo: string | null;
  loteId: string | null;
  fincaNombre: string | null;
};

export type MovimientoDetalleDTO = {
  id: string;
  codigo: string;
  consecutivo?: string; 
  tipo: MovimientoTipo;
  estado: MovimientoEstado;
  fecha: string | null;
  origen: string | null;
  destino: string | null;
  proveedor: string | null;
  solicitante: string | null;
  creador: string | null;
  productos: ProductoEnMovimientoDTO[];
  observacion: string | null;
};

// =============================
// Ingreso: tipos de entrada / salida
// =============================
export type IngresoItemInput = {
  productoId?: string;
  cantidad?: unknown;
  costo?: unknown;
  loteId?: string | null;
  /** Precio de referencia del producto al momento del ingreso (informativo). */
  precioref?: unknown;
};

export type RegistrarIngresoInput = {
  bodegaId?: string;
  proveedorId?: string | null;
  fecha?: string;
  tipoComprobante?: string;
  factura?: string;
  serie?: string | null;
  uuid?: string | null;
  observaciones?: string;
  items?: IngresoItemInput[];
};

export type IngresoLineaResultadoDTO = {
  productoid: string;
  nombre: string;
  cantidad: number;
  costoUnitario: number;
  unidad: string;
  loteId: string | null;
  preciorefActualizado: number;
};

export type IngresoDocumentoDTO = {
  id: string;
  consecutivo: string;
  tipo: "INGRESO";
  estado: MovimientoEstado;
  fecha: string;
  bodegaId: string;
  bodegaNombre: string;
  proveedorId: string | null;
  proveedorNombre: string | null;
  observaciones: string;
  creadorId: string;
  comprobanteFiscal: {
    id: string;
    tipocomprobante: string;
    numero: string;
    serie: string | null;
    nitemisor: string;
  } | null;
  items: IngresoLineaResultadoDTO[];
};

// =============================
// Helpers de validación
// =============================
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function textoOpcional(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const limpio = String(value).trim();
  return limpio.length > 0 ? limpio : null;
}

/** Convierte a número aceptando "1,5" (coma decimal) además de "1.5". */
function aNumero(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const limpio = value.trim().replace(",", ".");
    if (limpio === "") return null;
    const n = Number(limpio);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Error genérico de validación (siempre 400) con código para que el
 * frontend pueda resaltar el campo culpable.
 */
function errorValidacion(message: string, codigo: string): MovimientoError {
  return new MovimientoError(message, 400, codigo);
}

/**
 * Indica si TODAS las líneas de un producto llegaron sin costo.
 * En ese caso no se sobrescribe `precioref` con 0, se conserva el vigente.
 */
function costoTodosOmitidos(
  lineas: { productoId: string; costoOmitido: boolean }[],
  productoId: string
): boolean {
  const delProducto = lineas.filter((l) => l.productoId === productoId);
  return delProducto.length > 0 && delProducto.every((l) => l.costoOmitido);
}

// ---------------------------------------------------------------------
// CALCULAR MODA (precio de referencia)
// ---------------------------------------------------------------------
/**
 * Devuelve el precio que más se repite. En caso de empate gana el primero
 * recibido (el caller lo invoca con los precios ordenados del más reciente
 * al más antiguo, por lo que el empate se resuelve hacia lo reciente).
 */
function calcularModa(precios: number[]): number {
  if (precios.length === 0) return 0;

  const frecuencia = new Map<number, number>();
  let maxFrecuencia = 0;
  let moda = precios[0];

  for (const p of precios) {
    const actual = (frecuencia.get(p) ?? 0) + 1;
    frecuencia.set(p, actual);

    if (actual > maxFrecuencia) {
      maxFrecuencia = actual;
      moda = p;
    }
  }
  return moda;
}

// =============================
// Servicio
// =============================
export const movimientosService = {

  // ---------------------------------------
  // REGISTRAR INGRESO (entrada a inventario)
  // ---------------------------------------
  /**
   * Registra un documento INGRESO con sus líneas dentro de una transacción.
   *
   * Reglas de negocio aplicadas:
   *  - `bodegaId` debe existir y `items` debe traer al menos 1 línea.
   *  - Cada línea: `productoId` existente, `cantidad > 0`, `costo >= 0`
   *    (un `costo` vacío/nulo se interpreta como 0, ver `costoOmitido` en la línea).
   *  - Si viene `loteId`, el lote debe existir.
   *  - Si viene `proveedorId`, el proveedor debe existir.
   *  - Si hay `proveedorId` + `factura`, no puede repetirse el comprobante
   *    `(proveedorid, numero, serie)` — con `serie` nula se compara solo
   *    `(proveedorid, numero)`.
   *  - Recalcula `producto.precioref` con la moda de los últimos ingresos.
   *
   * Lanza `MovimientoError` (400/404/409) para errores de negocio.
   */
  async registrarIngreso(input: RegistrarIngresoInput, creadorId: string): Promise<IngresoDocumentoDTO> {
    if (!creadorId) {
      throw new MovimientoError("Error de identidad: usuario creador no disponible.", 403, "SIN_IDENTIDAD");
    }

    // ---------- 1. Validaciones de cabecera ----------
    const bodegaId = textoOpcional(input.bodegaId);
    if (!bodegaId) {
      throw errorValidacion("El campo 'bodegaId' es obligatorio.", "BODEGA_REQUERIDA");
    }

    const items = input.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw errorValidacion("Debes incluir al menos un producto en 'items'.", "ITEMS_VACIOS");
    }
    if (items.length > 200) {
      throw errorValidacion("El ingreso no puede tener más de 200 líneas.", "ITEMS_LIMITE");
    }

    // Normalizar y validar cada línea ANTES de abrir la transacción
    const lineas: { productoId: string; cantidad: number; costo: number; costoOmitido: boolean; loteId: string | null }[] = [];

    items.forEach((item, index) => {
      const n = index + 1;
      const productoId = textoOpcional(item?.productoId);
      if (!productoId) {
        throw errorValidacion(`Línea ${n}: el campo 'productoId' es obligatorio.`, "PRODUCTO_ID_REQUERIDO");
      }
      if (!UUID_REGEX.test(productoId)) {
        throw errorValidacion(`Línea ${n}: 'productoId' no tiene un formato válido.`, "PRODUCTO_ID_INVALIDO");
      }

      const cantidad = aNumero(item?.cantidad);
      if (cantidad === null) {
        throw errorValidacion(`Línea ${n}: la 'cantidad' es obligatoria y debe ser numérica.`, "CANTIDAD_INVALIDA");
      }
      if (cantidad <= 0) {
        throw errorValidacion(`Línea ${n}: la 'cantidad' debe ser mayor a 0.`, "CANTIDAD_NO_POSITIVA");
      }

      // costo vacío/nulo => 0 (regla acordada); costo inválido o negativo => 400
      const costoCrudo = item?.costo;
      const costoOmitido = costoCrudo === undefined || costoCrudo === null || costoCrudo === "";
      const costo = costoOmitido ? 0 : aNumero(costoCrudo);
      if (costo === null) {
        throw errorValidacion(`Línea ${n}: el 'costo' debe ser numérico.`, "COSTO_INVALIDO");
      }
      if (costo < 0) {
        throw errorValidacion(`Línea ${n}: el 'costo' no puede ser negativo.`, "COSTO_NEGATIVO");
      }

      const loteId = textoOpcional(item?.loteId);

      lineas.push({ productoId, cantidad, costo, costoOmitido, loteId });
    });

    const proveedorId = textoOpcional(input.proveedorId);
    if (proveedorId && !UUID_REGEX.test(proveedorId)) {
      throw errorValidacion("'proveedorId' no tiene un formato válido.", "PROVEEDOR_ID_INVALIDO");
    }

    const factura = textoOpcional(input.factura);
    const serie = textoOpcional(input.serie);
    const tipoComprobante = textoOpcional(input.tipoComprobante) ?? "FACTURA";
    const uuidFiscal = textoOpcional(input.uuid);
    const observaciones = textoOpcional(input.observaciones) ?? "";

    // ---------- 2. Validaciones contra BD ----------
    const bodega = await prisma.bodega.findUnique({ where: { id: bodegaId }, select: { id: true, nombre: true } });
    if (!bodega) {
      throw new MovimientoError("La bodega indicada no existe.", 404, "BODEGA_NO_ENCONTRADA");
    }

    let proveedor: { id: string; nombre: string; nit: string | null } | null = null;
    if (proveedorId) {
      proveedor = await prisma.proveedor.findUnique({
        where: { id: proveedorId },
        select: { id: true, nombre: true, nit: true },
      });
      if (!proveedor) {
        throw new MovimientoError("El proveedor indicado no existe.", 404, "PROVEEDOR_NO_ENCONTRADO");
      }
    }

    // Productos: una sola consulta para todas las líneas (evita N+1)
    const productoIds = [...new Set(lineas.map((l) => l.productoId))];
    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: { id: true, nombre: true, unidadid: true },
    });
    const productosMap = new Map(productos.map((p) => [p.id, p]));

    const faltantes = productoIds.filter((id) => !productosMap.has(id));
    if (faltantes.length > 0) {
      throw new MovimientoError(
        `Producto no encontrado: ${faltantes.join(", ")}`,
        404,
        "PRODUCTO_NO_ENCONTRADO"
      );
    }

    // Lotes opcionales
    const loteIds = [...new Set(lineas.map((l) => l.loteId).filter((id): id is string => !!id))];
    if (loteIds.length > 0) {
      const lotes = await prisma.lote.findMany({ where: { id: { in: loteIds } }, select: { id: true } });
      const lotesValidos = new Set(lotes.map((l) => l.id));
      const loteFaltante = loteIds.find((id) => !lotesValidos.has(id));
      if (loteFaltante) {
        throw new MovimientoError(`Lote no encontrado: ${loteFaltante}`, 404, "LOTE_NO_ENCONTRADO");
      }
    }

    // ---------- 3. Prevención de factura duplicada ----------
    if (proveedorId && factura) {
      const duplicado = await prisma.comprobante_fiscal.findFirst({
        where: serie
          ? { numero: factura, serie, documento: { proveedorid: proveedorId } }
          : { numero: factura, documento: { proveedorid: proveedorId } },
        select: { id: true, documentoid: true },
      });

      if (duplicado) {
        throw new MovimientoError(
          "Esta factura ya fue registrada para este proveedor",
          409,
          "FACTURA_DUPLICADA"
        );
      }
    }

    // ---------- 4. Escritura transaccional ----------
    const documento = await prisma.$transaction(
      async (tx) => {
        const anioActual = new Date().getFullYear();
        let nuevoCorrelativo = 1;

        const contador = await tx.consecutivo.findUnique({
          where: { tipo_anio: { tipo: "INGRESO", anio: anioActual } },
        });

        if (contador) {
          const actualizado = await tx.consecutivo.update({
            where: { id: contador.id },
            data: { ultimo: { increment: 1 } },
          });
          nuevoCorrelativo = actualizado.ultimo ?? 1;
        } else {
          await tx.consecutivo.create({
            data: { tipo: "INGRESO", anio: anioActual, ultimo: 1, prefijo: "ING" },
          });
          nuevoCorrelativo = 1;
        }

        const codigoGenerado = `ING-${anioActual}-${nuevoCorrelativo.toString().padStart(4, "0")}`;
        const fechaDocumento = input.fecha ? new Date(input.fecha) : new Date();
        const fechaValida = Number.isNaN(fechaDocumento.getTime()) ? new Date() : fechaDocumento;

        const docCreado = await tx.documento.create({
          data: {
            tipo: "INGRESO",
            estado: "APROBADO",
            consecutivo: codigoGenerado,
            fecha: fechaValida,
            bodegadestinoid: bodega.id,
            proveedorid: proveedorId,
            creadorid: creadorId,
            observacion: observaciones,
          },
        });

        // Comprobante fiscal (solo si hay proveedor + número de factura)
        let comprobante: IngresoDocumentoDTO["comprobanteFiscal"] = null;
        if (proveedorId && factura) {
          const cf = await tx.comprobante_fiscal.create({
            data: {
              documentoid: docCreado.id,
              tipocomprobante: tipoComprobante,
              nitemisor: proveedor?.nit ?? "CF",
              numero: factura,
              serie,
              uuid: uuidFiscal,
              fechaemision: fechaValida,
            },
            select: { id: true, tipocomprobante: true, numero: true, serie: true, nitemisor: true },
          });
          comprobante = cf;
        }

        const resultadoLineas: IngresoLineaResultadoDTO[] = [];

        // Agrupar por producto para recalcular `precioref` una sola vez por producto
        const nuevoCostoPorProducto = new Map<string, number>();
        for (const linea of lineas) {
          if (!nuevoCostoPorProducto.has(linea.productoId)) {
            nuevoCostoPorProducto.set(linea.productoId, linea.costo);
          }
        }

        for (const linea of lineas) {
          const producto = productosMap.get(linea.productoId)!;

          await tx.documento_item.create({
            data: {
              documentoid: docCreado.id,
              productoid: linea.productoId,
              cantidad: new Prisma.Decimal(linea.cantidad),
              costounit: new Prisma.Decimal(linea.costo),
              unidadid: producto.unidadid,
              loteid: linea.loteId,
            },
          });

          resultadoLineas.push({
            productoid: linea.productoId,
            nombre: producto.nombre,
            cantidad: linea.cantidad,
            costoUnitario: linea.costo,
            unidad: producto.unidadid,
            loteId: linea.loteId,
            preciorefActualizado: 0, // se completa tras recalcular
          });
        }

        // Recalcular `precioref` con la moda (solo productos con costo real informado)
        for (const [productoId, costoNuevo] of nuevoCostoPorProducto) {
          const costoOmitido = costoTodosOmitidos(lineas, productoId);

          const ultimosIngresos = await tx.documento_item.findMany({
            where: {
              productoid: productoId,
              documento: { tipo: "INGRESO", estado: "APROBADO" },
            },
            orderBy: { createdat: "desc" },
            take: 10,
            select: { costounit: true },
          });

          const precios = ultimosIngresos
            .map((u) => aNumero(u.costounit))
            .filter((p): p is number => p !== null);

          if (precios.length === 0) precios.push(costoNuevo);

          const nuevoPrecioRef = calcularModa(precios);

          if (!(costoOmitido && nuevoPrecioRef === 0)) {
            await tx.producto.update({
              where: { id: productoId },
              data: { precioref: new Prisma.Decimal(nuevoPrecioRef) },
            });
          }

          for (const r of resultadoLineas) {
            if (r.productoid === productoId) r.preciorefActualizado = nuevoPrecioRef;
          }
        }

        return {
          id: docCreado.id,
          consecutivo: codigoGenerado,
          tipo: "INGRESO" as const,
          estado: (docCreado.estado ?? "APROBADO") as MovimientoEstado,
          fecha: fechaValida.toISOString(),
          bodegaId: bodega.id,
          bodegaNombre: bodega.nombre,
          proveedorId: proveedor?.id ?? null,
          proveedorNombre: proveedor?.nombre ?? null,
          observaciones,
          creadorId,
          comprobanteFiscal: comprobante,
          items: resultadoLineas,
        };
      },
      { maxWait: 5000, timeout: 20000 }
    );

    return documento;
  },

  // ---------------------------------------
  // LISTADO DE DOCUMENTOS / MOVIMIENTOS
  // ---------------------------------------
  async getListadoMovimientos(usuario?: { id: string; rol: string }): Promise<MovimientoResumenDTO[]> {
    const where: any = {};

    if (usuario && usuario.rol === "SOLICITANTE") {
        where.solicitanteid = usuario.id;
    }

    try {
        const documentos = await prisma.documento.findMany({
          where,
          orderBy: { createdat: "desc" },
          take: 50,
          include: {
            proveedor: true,
            bodega_documento_bodegaorigenidTobodega: true,
            bodega_documento_bodegadestinoidTobodega: true,
            documento_item: { select: { id: true } },
          },
        });

        return documentos.map((d) => {
          const origen = d.bodega_documento_bodegaorigenidTobodega?.nombre ?? null;
          const destino = d.bodega_documento_bodegadestinoidTobodega?.nombre ?? null;
          const proveedor = d.proveedor?.nombre ?? null;
          const productosLabel = `${d.documento_item.length} productos`;

          return {
            id: d.id,
            codigo: d.consecutivo ?? d.id,
            tipo: d.tipo as MovimientoTipo,
            estado: d.estado as MovimientoEstado,
            origen,
            destino,
            proveedor,
            productos: productosLabel,
            fecha: d.fecha ? d.fecha.toISOString() : null,
            createdat: d.createdat ? d.createdat.toISOString() : undefined
          };
        });
    } catch (error) {
        console.error("Error en prisma.documento.findMany:", error);
        throw error;
    }
  },

  // ---------------------------------------
  // DETALLE DE UN DOCUMENTO / MOVIMIENTO
  // ---------------------------------------
  async getDetalleMovimiento(idOrCodigo: string): Promise<MovimientoDetalleDTO> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCodigo);
    const whereClause = isUuid ? { id: idOrCodigo } : { consecutivo: idOrCodigo };

    const doc = await prisma.documento.findFirst({
      where: whereClause,
      include: {
        proveedor: true,
        bodega_documento_bodegaorigenidTobodega: true,
        bodega_documento_bodegadestinoidTobodega: true,
        usuario_documento_creadoridTousuario: true,
        usuario_documento_solicitanteidTousuario: true,
        comprobante_fiscal: true,
        solicitud: true,
        documento_item: {
          include: {
            producto: true,
            unidad: true,
            lote: { include: { finca: true } },
          },
        },
      },
    });

    if (!doc) {
      throw new Error(`Documento no encontrado: ${idOrCodigo}`);
    }

    const origen = doc.bodega_documento_bodegaorigenidTobodega?.nombre ?? null;
    const destino = doc.bodega_documento_bodegadestinoidTobodega?.nombre ?? null;
    const proveedor = doc.proveedor?.nombre ?? null;
    const solicitante = doc.usuario_documento_solicitanteidTousuario?.nombre ?? null;
    const creador = doc.usuario_documento_creadoridTousuario?.nombre ?? null;

    const productos: ProductoEnMovimientoDTO[] = doc.documento_item.map((item) => {
      const cantidadNum = Number(item.cantidad) || 0;
      const unidad = item.unidad?.abreviatura ?? "";
      const loteCodigo = item.lote?.codigo ?? null;
      const loteId = item.lote?.id ?? null;
      const fincaNombre = item.lote?.finca?.nombre ?? null;

      return {
        id: item.id,
        productoNombre: item.producto?.nombre ?? "",
        productoCodigo: item.producto?.codigo ?? "",
        cantidad: `${cantidadNum} ${unidad}`.trim(),
        unidad,
        loteCodigo,
        loteId,
        fincaNombre,
      };
    });

    return {
      id: doc.id,
      codigo: doc.consecutivo ?? doc.id,
      consecutivo: doc.consecutivo ?? undefined,
      tipo: doc.tipo as MovimientoTipo,
      estado: doc.estado as MovimientoEstado,
      fecha: doc.fecha ? doc.fecha.toISOString() : null,
      origen,
      destino,
      proveedor,
      solicitante,
      creador,
      productos,
      observacion: doc.observacion ?? null,
    };
  },

  // ---------------------------------------
  // EXPORTS en PDF
  // ---------------------------------------
  async exportListadoMovimientosPDF(): Promise<{ filename: string; mime: string; content: Buffer }> {
    const movimientos = await this.getListadoMovimientos();
    const buffer = await buildPDF((doc) => {
      doc.fontSize(16).text("Listado de movimientos", { align: "center" });
      doc.moveDown();
      doc.fontSize(10);
      movimientos.forEach((m) => {
        doc.font("Helvetica-Bold").text(`Documento: ${m.codigo}`, { continued: false });
        doc.font("Helvetica").text(`Tipo: ${m.tipo}   Estado: ${m.estado}`);
        doc.text(`Origen: ${m.origen ?? "-"}   Destino: ${m.destino ?? "-"}`);
        doc.text(`Proveedor: ${m.proveedor ?? "-"}`);
        doc.text(`Productos: ${m.productos}`);
        doc.text(`Fecha: ${m.fecha ?? "-"}`);
        doc.moveDown(0.8);
      });
    });
    return { filename: "movimientos.pdf", mime: "application/pdf", content: buffer };
  },

  async exportMovimientoDetallePDF(id: string): Promise<{ filename: string; mime: string; content: Buffer }> {
    const det = await this.getDetalleMovimiento(id);
    const buffer = await buildPDF((doc) => {
      doc.fontSize(16).text(`Documento ${det.codigo}`, { align: "center" });
      doc.moveDown();
      doc.fontSize(10);
      doc.text(`Tipo: ${det.tipo}`);
      doc.text(`Estado: ${det.estado}`);
      doc.text(`Fecha: ${det.fecha ?? "-"}`);
      // ... Resto de campos
      doc.moveDown();
      doc.fontSize(12).text("Productos", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      det.productos.forEach((p) => {
        doc.font("Helvetica-Bold").text(p.productoNombre);
        doc.font("Helvetica").text(`Código: ${p.productoCodigo}   Cantidad: ${p.cantidad}`);
        doc.text(`Lote: ${p.loteCodigo ?? "-"}   Finca: ${p.fincaNombre ?? "-"}`);
        doc.moveDown(0.6);
      });
    });
    const safeCodigo = det.codigo.replace(/[^a-zA-Z0-9_-]/g, "_");
    return { filename: `documento_${safeCodigo}.pdf`, mime: "application/pdf", content: buffer };
  },
};