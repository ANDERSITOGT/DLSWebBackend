// src/services/solicitudesService.ts
import prisma from "../prisma";
import PDFDocument from "pdfkit";

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
// LISTA - para las tarjetas de "Mis Solicitudes"
// ===================================================
async function getSolicitudes(opciones: {
  estado?: EstadoSolicitud;
  solicitanteId?: string;
}) {
  const { estado, solicitanteId } = opciones;
  const where: any = {};

  if (estado) where.estado = estado; // campo "estado" (enum estado_solicitud)
  if (solicitanteId) where.solicitanteid = solicitanteId;

  const solicitudes = await prisma.solicitud.findMany({
    where,
    orderBy: { fecha: "desc" },
    include: {
      bodega: true,
      usuario_solicitud_solicitanteidTousuario: true,
      solicitud_item: true, // solo para saber cuántos productos tiene
    },
  });

  return solicitudes.map((s) => ({
    id: s.id,
    codigo: s.id, // de momento usamos el id como código
    fecha: s.fecha,
    estado: s.estado as EstadoSolicitud,
    bodegaNombre: s.bodega?.nombre ?? "",
    solicitanteNombre: s.usuario_solicitud_solicitanteidTousuario?.nombre ?? "",
    totalProductos: s.solicitud_item.length,
  }));
}

// ===================================================
// DETALLE - para el modal
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
    throw new Error("Solicitud no encontrada");
  }

  return {
    id: solicitud.id,
    codigo: solicitud.id, // de momento
    fecha: solicitud.fecha,
    estado: solicitud.estado as EstadoSolicitud,
    // no existe campo comentarios en el schema, así que no lo ponemos
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
      nombre: d.producto?.nombre ?? "",
      codigo: d.producto?.codigo ?? "",
      cantidad: d.cantidad,
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
// (crea cabecera + items)
// ===================================================
async function crearSolicitud(input: CrearSolicitudDTO) {
  const { fecha, solicitanteid, bodegaid, productos } = input;

  // Generamos un código tipo SOL-2025-0001 y lo usamos como "id"
  const baseDate = fecha ? new Date(fecha) : new Date();
  const year = baseDate.getFullYear();

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
      id: codigo, // sobreescribimos el default de uuid con nuestro código
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
// CAMBIAR ESTADO (aprobar, rechazar, entregada)
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
// GENERAR PDF DEL DETALLE
// (sin get-stream, usando buffers manualmente)
// ===================================================
async function exportSolicitudDetallePDF(id: string) {
  const detalle = await getDetalleSolicitud(id);

  const doc = new PDFDocument({ margin: 40, size: "A4" });

  // Recolectar los chunks en memoria y devolver un Buffer
  const chunks: Buffer[] = [];

  return await new Promise<{ filename: string; mime: string; content: Buffer }>(
    (resolve, reject) => {
      doc.on("data", (chunk) => {
        chunks.push(chunk as Buffer);
      });

      doc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const filename = `${detalle.codigo}.pdf`;
        const mime = "application/pdf";
        resolve({ filename, mime, content: buffer });
      });

      doc.on("error", (err) => {
        reject(err);
      });

      // ======= CONTENIDO DEL PDF =======
      doc.fontSize(18).text(`Solicitud ${detalle.codigo}`, { align: "left" });
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .text(`Fecha: ${detalle.fecha?.toISOString().slice(0, 10) ?? ""}`);
      doc.text(`Estado: ${detalle.estado}`);
      if (detalle.bodega) {
        doc.text(`Bodega: ${detalle.bodega.nombre}`);
      }
      doc.text(`Solicitante: ${detalle.solicitante.nombre}`);
      if (detalle.documentoSalidaConsecutivo) {
        doc.text(
          `Documento de salida: ${detalle.documentoSalidaConsecutivo} (${detalle.documentoSalidaId})`
        );
      }

      doc.moveDown(1);
      doc.fontSize(12).text("Productos", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);

      detalle.productos.forEach((p) => {
        doc.text(
          `• ${p.nombre} (${p.codigo}) - ${p.cantidad} ${p.unidad}${
            p.loteCodigo ? ` | Lote: ${p.loteCodigo}` : ""
          }${p.notas ? ` — ${p.notas}` : ""}`
        );
      });

      doc.end();
      // ======= FIN CONTENIDO PDF =======
    }
  );
}

export default {
  getSolicitudes,
  getDetalleSolicitud,
  crearSolicitud,
  actualizarEstadoSolicitud,
  exportSolicitudDetallePDF,
};
