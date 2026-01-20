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
  fecha?: string;
  solicitanteid?: string; // Opcional porque lo puede inferir del usuario
  bodegaid?: string | null;
  productos: CrearSolicitudProductoDTO[];
  tipo?: "DESPACHO" | "DEVOLUCION";
  solicitudOrigenId?: string; 
};

// ===================================================
// LISTAR - Mis Solicitudes
// ===================================================
async function getSolicitudes(opciones: {
  estado?: EstadoSolicitud;
  usuario?: { id: string; rol: string };
  tipo?: "DESPACHO" | "DEVOLUCION"; 
}) {
  const { estado, usuario, tipo } = opciones;
  const where: any = {};

  if (estado) where.estado = estado;
  if (tipo) where.tipo = tipo;

  // 🛡️ SEGURIDAD DE LECTURA: Solicitante solo ve lo suyo
  if (usuario?.rol === "SOLICITANTE") {
      where.solicitanteid = usuario.id;
  }

  const solicitudes = await prisma.solicitud.findMany({
    where,
    orderBy: { fecha: "desc" },
    take: 50,
    include: {
      bodega: true,
      usuario_solicitud_solicitanteidTousuario: true,
      solicitud_item: true,
      other_solicitud: { 
          where: { 
            tipo: "DEVOLUCION",
            estado: { not: "RECHAZADA" }
          },
          select: { id: true } 
      }
    },
  });

  return solicitudes.map((s) => ({
    id: s.id,
    codigo: s.id,
    fecha: s.fecha,
    estado: s.estado as EstadoSolicitud,
    tipo: (s as any).tipo || "DESPACHO",
    bodegaNombre: s.bodega?.nombre ?? "Sin Bodega",
    solicitanteNombre: s.usuario_solicitud_solicitanteidTousuario?.nombre ?? "Desconocido",
    totalProductos: s.solicitud_item.length,
    yaDevuelta: s.other_solicitud && s.other_solicitud.length > 0 
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
          lote: { include: { cultivo: true } }, 
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
    tipo: (solicitud as any).tipo || "DESPACHO",
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
      itemId: d.id,
      productoId: d.productoid,
      productoObjId: d.producto?.id,
      nombre: d.producto?.nombre ?? "Producto eliminado",
      codigo: d.producto?.codigo ?? "---",
      cantidad: Number(d.cantidad), 
      unidad: d.unidad?.abreviatura ?? "",
      unidadNombre: d.unidad?.nombre ?? "",
      loteId: d.loteid ?? null,
      loteCodigo: d.lote?.codigo ?? "Sin Lote",
      cultivo: d.lote?.cultivo?.nombre || "General",
      notas: d.notas ?? null,
    })),
    documentoSalidaId: solicitud.documentosalidaid ?? null,
    documentoSalidaConsecutivo: solicitud.documento?.consecutivo ?? null,
  };
}

// ===================================================
// CREAR SOLICITUD (CON SEGURIDAD Y STOCK)
// ===================================================
async function crearSolicitud(input: CrearSolicitudDTO, usuarioActual: { id: string; rol: string }) {
  const { fecha, solicitanteid, bodegaid, productos, tipo = "DESPACHO", solicitudOrigenId } = input;

  // 1. Determinar quién es el solicitante real
  // Si soy ADMIN, puedo pedir a nombre de otro. Si soy SOLICITANTE, soy yo mismo.
  const finalSolicitanteId = (usuarioActual.rol === 'ADMIN' && solicitanteid) ? solicitanteid : usuarioActual.id;

  if (!finalSolicitanteId) throw new Error("No se pudo identificar al solicitante.");

  // Transacción para asegurar integridad
  const nuevaSolicitud = await prisma.$transaction(async (tx) => {
    
    // A. Validar Devoluciones Duplicadas
    if (tipo === "DEVOLUCION" && solicitudOrigenId) {
        const yaExiste = await tx.solicitud.findFirst({
            where: { solicitud_origen_id: solicitudOrigenId, estado: { not: "RECHAZADA" } }
        });
        if (yaExiste) throw new Error(`La solicitud ${solicitudOrigenId} ya tiene una devolución activa.`);
    }

    // B. VALIDAR ITEMS (Seguridad Lote + Stock)
    for (const item of productos) {
        
        // 🔒 SEGURIDAD: ¿Tiene permiso en este lote?
        if (item.loteid && usuarioActual.rol === 'SOLICITANTE') {
            const permiso = await tx.lote_encargado.findFirst({
                where: { loteid: item.loteid, usuarioid: finalSolicitanteId }
            });
            if (!permiso) {
                // Buscamos info para un error más claro
                const loteInfo = await tx.lote.findUnique({ where: { id: item.loteid }, select: { codigo: true } });
                throw new Error(`SEGURIDAD: No tienes permiso asignado para el lote ${loteInfo?.codigo || 'seleccionado'}.`);
            }
        }

        // 📦 STOCK: Solo validar si es DESPACHO
        if (tipo === "DESPACHO") {
            // Calcular Stock Físico
            const ingresos = await tx.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: item.productoid, documento: { tipo: "INGRESO", estado: "APROBADO" } } });
            const salidas = await tx.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: item.productoid, documento: { tipo: "SALIDA", estado: "APROBADO" } } });
            const ajustes = await tx.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: item.productoid, documento: { tipo: "AJUSTE", estado: "APROBADO" } } });
            const devIn = await tx.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: item.productoid, documento: { tipo: "DEVOLUCION", estado: "APROBADO", proveedorid: null } } });
            const devOut = await tx.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: item.productoid, documento: { tipo: "DEVOLUCION", estado: "APROBADO", NOT: { proveedorid: null } } } });

            const stockFisico = ((Number(ingresos._sum.cantidad)||0) + (Number(devIn._sum.cantidad)||0) + (Number(ajustes._sum.cantidad)||0)) - ((Number(salidas._sum.cantidad)||0) + (Number(devOut._sum.cantidad)||0));

            // Calcular Stock Comprometido
            const comprometido = await tx.solicitud_item.aggregate({
                _sum: { cantidad: true },
                where: {
                    productoid: item.productoid,
                    solicitud: { estado: { in: ["PENDIENTE", "APROBADA"] }, tipo: "DESPACHO" }
                }
            });

            const stockComprometido = Number(comprometido._sum.cantidad) || 0;
            const disponible = stockFisico - stockComprometido;

            if (Number(item.cantidad) > disponible) {
                const prod = await tx.producto.findUnique({ where: { id: item.productoid } });
                throw new Error(`Stock insuficiente para "${prod?.nombre}". Disponible: ${disponible}, Solicitado: ${item.cantidad}`);
            }
        }
    }

    // C. Generar Consecutivo (SOL-2026-XXXX)
    const anioActual = new Date().getFullYear();
    let correlativo = 1;
    const contador = await tx.consecutivo.findUnique({ where: { tipo_anio: { tipo: "SOLICITUD", anio: anioActual } } });

    if (contador) {
        const upd = await tx.consecutivo.update({ where: { id: contador.id }, data: { ultimo: { increment: 1 } } });
        correlativo = upd.ultimo || 1;
    } else {
        await tx.consecutivo.create({ data: { tipo: "SOLICITUD", anio: anioActual, ultimo: 1, prefijo: "SOL" } });
    }
    const codigo = `SOL-${anioActual}-${String(correlativo).padStart(4, '0')}`;

    // D. Crear Solicitud
    const nueva = await tx.solicitud.create({
      data: {
        id: codigo,
        fecha: fecha ? new Date(fecha) : new Date(),
        estado: "PENDIENTE",
        tipo: tipo,
        solicitanteid: finalSolicitanteId,
        bodegaid: bodegaid ?? null,
        solicitud_origen_id: solicitudOrigenId || null, 
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

    return nueva;
  });

  return getDetalleSolicitud(nuevaSolicitud.id);
}

// ===================================================
// ACTUALIZAR ESTADO
// ===================================================
async function actualizarEstadoSolicitud(id: string, estado: EstadoSolicitud, aprobadorId?: string | null) {
  const data: any = { estado };
  if (aprobadorId) data.aprobadorid = aprobadorId;
  const actualizada = await prisma.solicitud.update({ where: { id }, data });
  return getDetalleSolicitud(actualizada.id);
}

// ===================================================
// EXPORTAR PDF
// ===================================================
async function exportSolicitudDetallePDF(id: string) {
  const detalle = await getDetalleSolicitud(id);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const chunks: Buffer[] = [];
  return await new Promise<{ filename: string; mime: string; content: Buffer }>((resolve, reject) => {
      doc.on("data", (chunk) => chunks.push(chunk as Buffer));
      doc.on("error", (err) => reject(err));
      doc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve({ filename: `${detalle.codigo}.pdf`, mime: "application/pdf", content: buffer });
      });
      
      // ... (Resto del diseño PDF igual que tenías) ...
      doc.fontSize(18).text(`Solicitud ${detalle.codigo}`, { align: "left" });
      doc.fontSize(10).text(`Tipo: ${detalle.tipo}`, { align: "left" });
      doc.moveDown(0.5);
      doc.text(`Fecha: ${detalle.fecha?.toISOString().split('T')[0] ?? ""}`);
      doc.text(`Estado: ${detalle.estado}`);
      if (detalle.bodega) doc.text(`Bodega: ${detalle.bodega.nombre}`);
      doc.text(`Solicitante: ${detalle.solicitante.nombre}`);
      doc.moveDown(1);
      doc.fontSize(12).text("Productos Solicitados", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      detalle.productos.forEach((p) => {
        const linea = `• ${p.nombre} (${p.codigo}) - ${p.cantidad} ${p.unidad}`;
        const extra = p.loteCodigo !== "Sin Lote" ? ` | Lote: ${p.loteCodigo} (${p.cultivo})` : "";
        const notas = p.notas ? ` | Nota: ${p.notas}` : "";
        doc.text(linea + extra + notas);
      });
      doc.end();
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