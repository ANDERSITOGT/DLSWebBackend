// src/services/solicitudesService.ts
import prisma from "../prisma";
import PDFDocument from "pdfkit";

// Definimos los tipos explícitamente para evitar errores
export type EstadoSolicitud = "PENDIENTE" | "APROBADA" | "RECHAZADA" | "ENTREGADA";

type CrearSolicitudProductoDTO = {
  productoid: string;
  unidadid: string;
  cantidad: number;
  loteid?: string | null;
  notas?: string;
};

export type CrearSolicitudDTO = {
  fecha?: string; // ISO
  solicitanteid: string;
  bodegaid?: string | null;
  productos: CrearSolicitudProductoDTO[];
};

// ===================================================
// LISTA - Mis Solicitudes (LIMITADO A 50)
// ===================================================
async function getSolicitudes(opciones: {
  estado?: EstadoSolicitud;
  solicitanteId?: string;
}) {
  const { estado, solicitanteId } = opciones;
  const where: any = {};

  if (estado) where.estado = estado;
  if (solicitanteId) where.solicitanteid = solicitanteId;

  const solicitudes = await prisma.solicitud.findMany({
    where,
    orderBy: { fecha: "desc" },
    take: 50, // 👈 1. LÍMITE DE 50 SOLICITUDES
    include: {
      bodega: true,
      usuario_solicitud_solicitanteidTousuario: true,
      solicitud_item: true,
    },
  });

  return solicitudes.map((s) => ({
    id: s.id,
    codigo: s.id,
    fecha: s.fecha,
    estado: s.estado as EstadoSolicitud,
    bodegaNombre: s.bodega?.nombre ?? "Sin Bodega",
    solicitanteNombre: s.usuario_solicitud_solicitanteidTousuario?.nombre ?? "Desconocido",
    totalProductos: s.solicitud_item.length,
  }));
}

// ===================================================
// DETALLE
// ===================================================
async function getDetalleSolicitud(id: string) {
  const solicitud = await prisma.solicitud.findUnique({
    where: { id },
    include: {
      bodega: true,
      usuario_solicitud_solicitanteidTousuario: true,
      solicitud_item: {
        include: {
          producto: true,
          unidad: true,
          lote: true,
        },
      },
      documento: true,
    },
  });

  if (!solicitud) {
    throw new Error(`Solicitud con id ${id} no encontrada`);
  }

  return {
    id: solicitud.id,
    codigo: solicitud.id,
    fecha: solicitud.fecha,
    estado: solicitud.estado as EstadoSolicitud,
    solicitante: {
      id: solicitud.solicitanteid,
      nombre: solicitud.usuario_solicitud_solicitanteidTousuario?.nombre ?? "",
    },
    bodega: solicitud.bodega
      ? {
          id: solicitud.bodegaid!,
          nombre: solicitud.bodega.nombre,
        }
      : null,
    productos: solicitud.solicitud_item.map((d) => ({
      id: d.id,
      productoId: d.productoid,
      nombre: d.producto?.nombre ?? "Producto eliminado",
      codigo: d.producto?.codigo ?? "---",
      cantidad: Number(d.cantidad), 
      unidad: d.unidad?.abreviatura ?? "",
      unidadNombre: d.unidad?.nombre ?? "",
      loteCodigo: d.lote?.codigo ?? null,
      notas: d.notas ?? null,
    })),
    documentoSalidaId: solicitud.documentosalidaid ?? null,
    documentoSalidaConsecutivo: solicitud.documento?.consecutivo ?? null,
  };
}

// ===================================================
// CREAR SOLICITUD
// ===================================================
async function crearSolicitud(input: CrearSolicitudDTO) {
  const { fecha, solicitanteid, bodegaid, productos } = input;

  const baseDate = fecha ? new Date(fecha) : new Date();
  const year = baseDate.getFullYear();

  // Lógica para generar ID consecutivo tipo SOL-2025-0001
  const countYear = await prisma.solicitud.count({
    where: {
      fecha: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  });

  const correlativo = String(countYear + 1).padStart(4, "0");
  const codigo = `SOL-${year}-${correlativo}`;

  const nueva = await prisma.solicitud.create({
    data: {
      id: codigo,
      fecha: baseDate,
      estado: "PENDIENTE",
      solicitanteid,
      bodegaid: bodegaid ?? null,
      solicitud_item: {
        create: productos.map((p) => ({
          productoid: p.productoid,
          unidadid: p.unidadid,
          cantidad: p.cantidad,
          loteid: p.loteid ?? null,
          notas: p.notas,
        })),
      },
    },
  });

  return getDetalleSolicitud(nueva.id);
}

// ===================================================
// CAMBIAR ESTADO
// ===================================================
async function actualizarEstadoSolicitud(
  id: string,
  estado: EstadoSolicitud,
  aprobadorId?: string | null 
) {
  const data: any = { estado };

  if (aprobadorId) {
    data.aprobadorid = aprobadorId;
  }

  const actualizada = await prisma.solicitud.update({
    where: { id },
    data,
  });

  return getDetalleSolicitud(actualizada.id);
}

// ===================================================
// EXPORTAR PDF
// ===================================================
async function exportSolicitudDetallePDF(id: string) {
  const detalle = await getDetalleSolicitud(id);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const chunks: Buffer[] = [];

  return await new Promise<{ filename: string; mime: string; content: Buffer }>(
    (resolve, reject) => {
      doc.on("data", (chunk) => chunks.push(chunk as Buffer));
      doc.on("error", (err) => reject(err));
      
      doc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          filename: `${detalle.codigo}.pdf`,
          mime: "application/pdf",
          content: buffer
        });
      });

      // --- Diseño del PDF ---
      doc.fontSize(18).text(`Solicitud ${detalle.codigo}`, { align: "left" });
      doc.moveDown(0.5);
      
      doc.fontSize(10);
      doc.text(`Fecha: ${detalle.fecha?.toISOString().split('T')[0] ?? ""}`);
      doc.text(`Estado: ${detalle.estado}`);
      
      if (detalle.bodega) {
        doc.text(`Bodega: ${detalle.bodega.nombre}`);
      }
      doc.text(`Solicitante: ${detalle.solicitante.nombre}`);

      doc.moveDown(1);
      doc.fontSize(12).text("Productos Solicitados", { underline: true });
      doc.moveDown(0.5);
      
      doc.fontSize(10);
      detalle.productos.forEach((p) => {
        const linea = `• ${p.nombre} (${p.codigo}) - ${p.cantidad} ${p.unidad}`;
        const extra = p.loteCodigo ? ` | Lote: ${p.loteCodigo}` : "";
        const notas = p.notas ? ` | Nota: ${p.notas}` : "";
        
        doc.text(linea + extra + notas);
      });

      doc.end();
    }
  );
}

// Exportación por defecto
export default {
  getSolicitudes,
  getDetalleSolicitud,
  crearSolicitud,
  actualizarEstadoSolicitud,
  exportSolicitudDetallePDF,
};