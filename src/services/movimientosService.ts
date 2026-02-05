import prisma from "../prisma";
import PDFDocument from "pdfkit";

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
// Servicio
// =============================
export const movimientosService = {
  
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