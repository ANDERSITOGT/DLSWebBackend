// src/services/movimientosService.ts
import prisma from "../prisma";
import PDFDocument from "pdfkit";

// =============================
// Helper para construir PDFs
// =============================
async function buildPDF(
  build: (doc: any) => void
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
    });

    const chunks: Buffer[] = [];

    doc.on("data", (chunk: any) => {
      chunks.push(chunk as Buffer);
    });

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on("error", (err: any) => {
      reject(err);
    });

    // El contenido real del PDF
    build(doc);

    doc.end();
  });
}

// =============================
// Tipos DTO para el frontend
// =============================

export type MovimientoTipo =
  | "INGRESO"
  | "SALIDA"
  | "TRANSFERENCIA"
  | "AJUSTE"
  | "DEVOLUCION";

export type MovimientoEstado = "BORRADOR" | "APROBADO" | "ANULADO";

export type MovimientoResumenDTO = {
  id: string;
  codigo: string; // consecutivo o id
  tipo: MovimientoTipo;
  estado: MovimientoEstado;
  origen: string | null;
  destino: string | null;
  proveedor: string | null;
  productos: string; // "2 productos"
  fecha: string | null; // ISO
};

export type ProductoEnMovimientoDTO = {
  id: string;
  productoNombre: string;
  productoCodigo: string;
  cantidad: string; // "50 kg"
  unidad: string;
  loteCodigo: string | null;
  loteId: string | null;
  fincaNombre: string | null;
};

export type MovimientoDetalleDTO = {
  id: string;
  codigo: string;
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

// ===== Lotes

export type EstadoLoteFront = "ACTIVO" | "INACTIVO";

export type LoteResumenDTO = {
  id: string;
  codigo: string;
  finca: string;
  cultivo: string;
  area: string; // "2.5 mz"
  estado: EstadoLoteFront;
  aplicacionesCount: number;
};

export type LoteAplicacionDTO = {
  id: string;
  documentoId: string;
  documentoCodigo: string;
  tipo: MovimientoTipo;
  fecha: string | null;
  bodega: string | null;
  producto: string;
  cantidad: string; // "10 L"
  unidad: string;
};

export type LoteDetalleDTO = {
  lote: LoteResumenDTO;
  aplicaciones: LoteAplicacionDTO[];
};

// =============================
// Servicio
// =============================

export const movimientosService = {
  // ---------------------------------------
  // LISTADO DE DOCUMENTOS / MOVIMIENTOS
  // ---------------------------------------
  async getListadoMovimientos(): Promise<MovimientoResumenDTO[]> {
    const documentos = await prisma.documento.findMany({
      orderBy: { fecha: "desc" },
      take: 50, // ✅ Mantenemos el límite de 50 aquí
      include: {
        proveedor: true,
        bodega_documento_bodegaorigenidTobodega: true,
        bodega_documento_bodegadestinoidTobodega: true,
        documento_item: {
          select: { id: true },
        },
      },
    });

    const data: MovimientoResumenDTO[] = documentos.map((d) => {
      const origen =
        d.bodega_documento_bodegaorigenidTobodega?.nombre ?? null;
      const destino =
        d.bodega_documento_bodegadestinoidTobodega?.nombre ?? null;
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
      };
    });

    return data;
  },

  // ---------------------------------------
  // DETALLE DE UN DOCUMENTO / MOVIMIENTO
  // ---------------------------------------
  async getDetalleMovimiento(id: string): Promise<MovimientoDetalleDTO> {
    const doc = await prisma.documento.findUnique({
      where: { id },
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
            lote: {
              include: {
                finca: true,
              },
            },
          },
        },
      },
    });

    if (!doc) {
      throw new Error("Documento no encontrado");
    }

    const origen =
      doc.bodega_documento_bodegaorigenidTobodega?.nombre ?? null;
    const destino =
      doc.bodega_documento_bodegadestinoidTobodega?.nombre ?? null;
    const proveedor = doc.proveedor?.nombre ?? null;

    const solicitante =
      doc.usuario_documento_solicitanteidTousuario?.nombre ?? null;
    const creador =
      doc.usuario_documento_creadoridTousuario?.nombre ?? null;

    const productos: ProductoEnMovimientoDTO[] = doc.documento_item.map(
      (item) => {
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
      }
    );

    return {
      id: doc.id,
      codigo: doc.consecutivo ?? doc.id,
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
  // LISTADO DE LOTES (vista Lotes)
  // ---------------------------------------
  async getListadoLotes(): Promise<LoteResumenDTO[]> {
    const lotes = await prisma.lote.findMany({
      include: {
        finca: true,
        cultivo: true,
      },
      orderBy: {
        createdat: "desc",
      },
      take: 50, // Aquí está bien limitar la lista general de lotes
    });

    const resultado: LoteResumenDTO[] = [];

    for (const lote of lotes) {
      let area = "-";
      if (lote.areamanzanas != null) {
        area = `${Number(lote.areamanzanas)} mz`;
      } else if (lote.areahectareas != null) {
        area = `${Number(lote.areahectareas)} ha`;
      } else if (lote.areametroslineales != null) {
        area = `${Number(lote.areametroslineales)} ml`;
      }

      const estadoFront: EstadoLoteFront =
        lote.estado === "ABIERTO" ? "ACTIVO" : "INACTIVO";

      const aplicacionesCount = await prisma.documento_item.count({
        where: {
          loteid: lote.id,
          documento: {
            tipo: "SALIDA",
          },
        },
      });

      resultado.push({
        id: lote.id,
        codigo: lote.codigo,
        finca: lote.finca?.nombre ?? "",
        cultivo: lote.cultivo?.nombre ?? "",
        area,
        estado: estadoFront,
        aplicacionesCount,
      });
    }

    return resultado;
  },

  // ---------------------------------------
  // DETALLE DE LOTE (historial de aplicaciones)
  // ---------------------------------------
  async getDetalleLote(loteId: string): Promise<LoteDetalleDTO> {
    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
      include: {
        finca: true,
        cultivo: true,
      },
    });

    if (!lote) {
      throw new Error("Lote no encontrado");
    }

    let area = "-";
    if (lote.areamanzanas != null) {
      area = `${Number(lote.areamanzanas)} mz`;
    } else if (lote.areahectareas != null) {
      area = `${Number(lote.areahectareas)} ha`;
    } else if (lote.areametroslineales != null) {
      area = `${Number(lote.areametroslineales)} ml`;
    }

    const estadoFront: EstadoLoteFront =
      lote.estado === "ABIERTO" ? "ACTIVO" : "INACTIVO";

    const aplicacionesRaw = await prisma.documento_item.findMany({
      where: {
        loteid: loteId,
        documento: {
          tipo: "SALIDA",
        },
      },
      orderBy: {
        createdat: "desc",
      },
      include: {
        producto: true,
        unidad: true,
        documento: {
          include: {
            bodega_documento_bodegaorigenidTobodega: true,
          },
        },
      },
      // ❌ take: 50,  <-- ELIMINADO para mostrar TODO el historial
    });

    const aplicaciones: LoteAplicacionDTO[] = aplicacionesRaw.map(
      (item) => {
        const doc = item.documento;
        const bodega =
          doc?.bodega_documento_bodegaorigenidTobodega?.nombre ?? null;

        const cantidadNum = Number(item.cantidad) || 0;
        const unidad = item.unidad?.abreviatura ?? "";

        return {
          id: item.id,
          documentoId: doc?.id ?? "",
          documentoCodigo: doc?.consecutivo ?? doc?.id ?? "",
          tipo: (doc?.tipo ?? "SALIDA") as MovimientoTipo,
          fecha: doc?.fecha ? doc.fecha.toISOString() : null,
          bodega,
          producto: item.producto?.nombre ?? "",
          cantidad: `${cantidadNum} ${unidad}`.trim(),
          unidad,
        };
      }
    );

    const loteFront: LoteResumenDTO = {
      id: lote.id,
      codigo: lote.codigo,
      finca: lote.finca?.nombre ?? "",
      cultivo: lote.cultivo?.nombre ?? "",
      area,
      estado: estadoFront,
      aplicacionesCount: aplicaciones.length, // Actualizado al total real
    };

    return {
      lote: loteFront,
      aplicaciones,
    };
  },

  // ---------------------------------------
  // EXPORTS en PDF (Sin cambios mayores)
  // ---------------------------------------

  async exportListadoMovimientosPDF(): Promise<{
    filename: string;
    mime: string;
    content: Buffer;
  }> {
    const movimientos = await this.getListadoMovimientos();

    const buffer = await buildPDF((doc) => {
      doc.fontSize(16).text("Listado de movimientos", {
        align: "center",
      });
      doc.moveDown();

      doc.fontSize(10);

      movimientos.forEach((m) => {
        doc
          .font("Helvetica-Bold")
          .text(`Documento: ${m.codigo}`, { continued: false });
        doc
          .font("Helvetica")
          .text(`Tipo: ${m.tipo}   Estado: ${m.estado}`);
        doc.text(
          `Origen: ${m.origen ?? "-"}   Destino: ${
            m.destino ?? "-"
          }`
        );
        doc.text(`Proveedor: ${m.proveedor ?? "-"}`);
        doc.text(`Productos: ${m.productos}`);
        doc.text(`Fecha: ${m.fecha ?? "-"}`);
        doc.moveDown(0.8);
        doc
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(
            doc.page.width - doc.page.margins.right,
            doc.y
          )
          .strokeColor("#CCCCCC")
          .lineWidth(0.5)
          .stroke();
        doc.moveDown(0.6);
      });
    });

    return {
      filename: "movimientos.pdf",
      mime: "application/pdf",
      content: buffer,
    };
  },

  async exportMovimientoDetallePDF(id: string): Promise<{
    filename: string;
    mime: string;
    content: Buffer;
  }> {
    const det = await this.getDetalleMovimiento(id);

    const buffer = await buildPDF((doc) => {
      doc.fontSize(16).text(`Documento ${det.codigo}`, {
        align: "center",
      });
      doc.moveDown();

      doc.fontSize(10);

      doc.text(`Tipo: ${det.tipo}`);
      doc.text(`Estado: ${det.estado}`);
      doc.text(`Fecha: ${det.fecha ?? "-"}`);
      doc.text(`Origen: ${det.origen ?? "-"}`);
      doc.text(`Destino: ${det.destino ?? "-"}`);
      doc.text(`Proveedor: ${det.proveedor ?? "-"}`);
      doc.text(`Solicitante: ${det.solicitante ?? "-"}`);
      doc.text(`Registrado por: ${det.creador ?? "-"}`);
      if (det.observacion) {
        doc.moveDown(0.5);
        doc.text(`Observación: ${det.observacion}`);
      }

      doc.moveDown();
      doc.fontSize(12).text("Productos", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);

      det.productos.forEach((p) => {
        doc
          .font("Helvetica-Bold")
          .text(p.productoNombre, { continued: false });
        doc.font("Helvetica").text(
          `Código: ${p.productoCodigo}   Cantidad: ${p.cantidad}`
        );
        doc.text(
          `Lote: ${p.loteCodigo ?? "-"}   Finca: ${
            p.fincaNombre ?? "-"
          }`
        );
        doc.moveDown(0.6);
      });
    });

    const safeCodigo = det.codigo.replace(/[^a-zA-Z0-9_-]/g, "_");

    return {
      filename: `documento_${safeCodigo}.pdf`,
      mime: "application/pdf",
      content: buffer,
    };
  },

  async exportHistorialLotePDF(loteId: string): Promise<{
    filename: string;
    mime: string;
    content: Buffer;
  }> {
    const detalle = await this.getDetalleLote(loteId);
    const { lote, aplicaciones } = detalle;

    const buffer = await buildPDF((doc) => {
      doc
        .fontSize(16)
        .text(`Historial de lote ${lote.codigo}`, {
          align: "center",
        });
      doc.moveDown();

      doc.fontSize(10);
      doc.text(`Finca: ${lote.finca}`);
      doc.text(`Cultivo: ${lote.cultivo}`);
      doc.text(`Área: ${lote.area}`);
      doc.text(`Estado: ${lote.estado}`);
      doc.text(
        `Aplicaciones registradas: ${lote.aplicacionesCount}`
      );

      doc.moveDown();
      doc
        .fontSize(12)
        .text("Historial de aplicaciones", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);

      aplicaciones.forEach((ap) => {
        doc
          .font("Helvetica-Bold")
          .text(`${ap.documentoCodigo} (${ap.tipo})`);
        doc.font("Helvetica").text(
          `Fecha: ${ap.fecha ?? "-"}   Bodega: ${ap.bodega ?? "-"}`
        );
        doc.text(
          `Producto: ${ap.producto}   Cantidad: ${ap.cantidad} ${
            ap.unidad
          }`
        );
        doc.moveDown(0.6);
      });
    });

    const safeCodigo = lote.codigo.replace(/[^a-zA-Z0-9_-]/g, "_");

    return {
      filename: `lote_${safeCodigo}_historial.pdf`,
      mime: "application/pdf",
      content: buffer,
    };
  },
};