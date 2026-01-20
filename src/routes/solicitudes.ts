import { Router, Response } from "express";
import prisma from "../prisma";
import { authenticateToken, AuthRequest } from "../middlewares/auth";
import solicitudesService from "../services/solicitudesService";

const router = Router();

// ===============================
// GET /api/solicitudes
// Listar (Usa Servicio)
// ===============================
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { estado, tipo } = req.query;
    const usuario = req.user; 

    const data = await solicitudesService.getSolicitudes({
      estado: estado as any,
      tipo: tipo as any, 
      usuario: usuario ? { id: usuario.id, rol: usuario.rol } : undefined,
    });
    
    res.json({ solicitudes: data }); 
  } catch (error) {
    console.error("Error en GET /api/solicitudes:", error);
    res.status(500).json({ message: "Error al obtener solicitudes" });
  }
});

// ===============================
// GET /api/solicitudes/:id
// Detalle (Usa Servicio)
// ===============================
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const data = await solicitudesService.getDetalleSolicitud(id);
    
    // Seguridad: Solicitante solo ve lo suyo
    if (req.user?.rol === "SOLICITANTE" && data.solicitante.id !== req.user.id) {
        return res.status(403).json({ message: "No tienes permiso para ver esta solicitud." });
    }

    res.json(data);
  } catch (error) {
    console.error("Error en GET /api/solicitudes/:id:", error);
    res.status(500).json({ message: "Error al obtener detalle" });
  }
});

// ===============================
// POST /api/solicitudes
// Crear (Usa Servicio - Lógica Refactorizada)
// ===============================
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  console.log("📥 Recibiendo solicitud:", req.body);

  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Usuario no autenticado" });

    // Delegamos la validación y creación al servicio
    const nuevaSolicitud = await solicitudesService.crearSolicitud({
        ...req.body,
        solicitanteid: req.body.solicitanteId 
    }, { id: user.id, rol: user.rol });

    console.log("✅ Solicitud creada:", nuevaSolicitud.id);
    res.status(201).json({ ok: true, solicitud: nuevaSolicitud });

  } catch (error: any) {
    console.error("❌ Error al guardar solicitud:", error);
    res.status(400).json({ message: error.message || "Error interno al guardar" });
  }
});

// ===============================
// PATCH /:id/estado
// Cambiar Estado (Usa Servicio)
// ===============================
router.patch("/:id/estado", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { estado } = req.body; 
    const aprobadorId = req.user?.id; 

    const data = await solicitudesService.actualizarEstadoSolicitud(id, estado, aprobadorId);
    res.json(data);
  } catch (error) {
    console.error("Error en PATCH /api/solicitudes/:id/estado:", error);
    res.status(500).json({ message: "Error al actualizar estado" });
  }
});

// ===============================
// GET /:id/export
// PDF (Usa Servicio)
// ===============================
router.get("/:id/export", async (req, res) => {
  try {
    const id = req.params.id;
    const { filename, mime, content } = await solicitudesService.exportSolicitudDetallePDF(id);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error("Error en GET /api/solicitudes/:id/export:", error);
    res.status(500).send("Error al exportar PDF");
  }
});

// ===============================
// POST /:id/entregar
// Generar Documento de Salida/Devolución
// (MANTENEMOS ESTA LÓGICA AQUÍ POR AHORA)
// ===============================
router.post("/:id/entregar", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const userId = req.user?.id; 

    if (!userId) {
        return res.status(401).json({ message: "No se pudo identificar al usuario que realiza la entrega." });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Obtener solicitud
      const solicitud = await tx.solicitud.findUnique({
        where: { id },
        include: { solicitud_item: true }
      });

      if (!solicitud) throw new Error("Solicitud no encontrada");
      
      if (solicitud.estado === "ENTREGADA" || solicitud.estado === "RECHAZADA") {
          throw new Error(`La solicitud ya está en estado ${solicitud.estado} y no se puede procesar nuevamente.`);
      }

      const esDespacho = solicitud.tipo === "DESPACHO";
      const tipoDocumento = esDespacho ? "SALIDA" : "DEVOLUCION";

      // 2. Consecutivo Documento
      const anioActual = new Date().getFullYear();
      let nuevoCorrelativo = 1;
      const prefijo = esDespacho ? "SAL" : "DEV";

      const contador = await tx.consecutivo.findUnique({
          where: { tipo_anio: { tipo: tipoDocumento, anio: anioActual } }
      });

      if (contador) {
          const actualizado = await tx.consecutivo.update({
              where: { id: contador.id },
              data: { ultimo: { increment: 1 } }
          });
          nuevoCorrelativo = actualizado.ultimo || 1;
      } else {
          await tx.consecutivo.create({
              data: { tipo: tipoDocumento, anio: anioActual, ultimo: 1, prefijo }
          });
          nuevoCorrelativo = 1;
      }
      
      const codigoDoc = `${prefijo}-${anioActual}-${nuevoCorrelativo.toString().padStart(4, '0')}`;

      // 3. Crear Documento Final
      const documento = await tx.documento.create({
        data: {
          tipo: tipoDocumento,
          estado: "APROBADO",
          fecha: new Date(),
          creadorid: userId,
          bodegaorigenid: esDespacho ? solicitud.bodegaid : null,   
          bodegadestinoid: !esDespacho ? solicitud.bodegaid : null, 
          solicitanteid: solicitud.solicitanteid,
          consecutivo: codigoDoc,
          observacion: `Generado automáticamente desde Solicitud ${solicitud.id} (${solicitud.tipo})`
        }
      });

      // 4. Mover Items y Validar Stock Final
      for (const item of solicitud.solicitud_item) {
        if (esDespacho) {
             const ingresos = await tx.documento_item.aggregate({_sum:{cantidad:true}, where:{productoid:item.productoid, documento:{tipo:"INGRESO", estado:"APROBADO"}}});
             const salidas = await tx.documento_item.aggregate({_sum:{cantidad:true}, where:{productoid:item.productoid, documento:{tipo:"SALIDA", estado:"APROBADO"}}});
             const ajustes = await tx.documento_item.aggregate({_sum:{cantidad:true}, where:{productoid:item.productoid, documento:{tipo:"AJUSTE", estado:"APROBADO"}}});
             const devInternas = await tx.documento_item.aggregate({_sum:{cantidad:true}, where:{productoid:item.productoid, documento:{tipo:"DEVOLUCION", estado:"APROBADO", proveedorid:null}}});
             const devExternas = await tx.documento_item.aggregate({_sum:{cantidad:true}, where:{productoid:item.productoid, documento:{tipo:"DEVOLUCION", estado:"APROBADO", NOT:{proveedorid:null}}}});

             const stockFisicoAlMomento = 
               ((Number(ingresos._sum.cantidad)||0) + (Number(devInternas._sum.cantidad)||0) + (Number(ajustes._sum.cantidad)||0)) - 
               ((Number(salidas._sum.cantidad)||0) + (Number(devExternas._sum.cantidad)||0));
            
            if (stockFisicoAlMomento < Number(item.cantidad)) {
                const prod = await tx.producto.findUnique({ where: { id: item.productoid }, select: { nombre: true } });
                throw new Error(`¡ALTO! Stock insuficiente para procesar entrega de "${prod?.nombre}". Hay: ${stockFisicoAlMomento}, Necesitas: ${item.cantidad}`);
            }
        }

        await tx.documento_item.create({
          data: {
            documentoid: documento.id,
            productoid: item.productoid,
            unidadid: item.unidadid,
            cantidad: item.cantidad,
            loteid: item.loteid,
            notas: item.notas
          }
        });
      }

      // 5. Actualizar Estado Solicitud
      const solicitudActualizada = await tx.solicitud.update({
        where: { id },
        data: {
          estado: "ENTREGADA",
          aprobadorid: userId,
          documentosalidaid: documento.id
        }
      });

      return { solicitud: solicitudActualizada, documentoId: documento.id, codigoDoc };
    });

    res.json(resultado);

  } catch (error: any) {
    console.error("Error en POST /api/solicitudes/:id/entregar:", error);
    res.status(400).json({ message: error.message || "Error al procesar la entrega" });
  }
});

export default router;