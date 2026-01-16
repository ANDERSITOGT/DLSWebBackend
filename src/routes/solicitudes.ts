// src/routes/solicitudes.ts
import { Router, Response } from "express";
import prisma from "../prisma";
import { authenticateToken, AuthRequest } from "../middlewares/auth";
import solicitudesService from "../services/solicitudesService";

const router = Router();

// ===============================
// GET /api/solicitudes
// (Restaurado: Sin authenticateToken para que cargue la lista)
// ===============================
router.get("/", async (req, res) => {
  try {
    const { estado, mis } = req.query;
    // Intentamos leer el usuario si viene, pero no forzamos error si no viene
    const user = (req as any).user;
    const solicitanteId = mis === "true" && user ? user.id : undefined;

    const data = await solicitudesService.getSolicitudes({
      estado: estado as any,
      solicitanteId,
    });
    res.json(data);
  } catch (error) {
    console.error("Error en GET /api/solicitudes:", error);
    res.status(500).json({ message: "Error al obtener solicitudes" });
  }
});

// ===============================
// GET /api/solicitudes/:id
// (Restaurado: Sin authenticateToken)
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const data = await solicitudesService.getDetalleSolicitud(id);
    res.json(data);
  } catch (error) {
    console.error("Error en GET /api/solicitudes/:id:", error);
    res.status(500).json({ message: "Error al obtener detalle" });
  }
});

// ===============================
// POST /api/solicitudes
// CREAR (Este SÍ lleva authenticateToken para identificar al usuario y evitar el error de ID)
// ===============================
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  console.log("📥 Recibiendo solicitud:", req.body);

  try {
    const { bodegaId, items, solicitanteId: bodySolicitanteId } = req.body;
    
    // 1. Identificar Usuario (Gracias a authenticateToken, req.user existe)
    const user = req.user;
    const finalSolicitanteId = user?.id ?? bodySolicitanteId;

    if (!finalSolicitanteId) {
        return res.status(400).json({ message: "No se identificó al solicitante" });
    }
    
    if (!bodegaId || !items || items.length === 0) {
        return res.status(400).json({ message: "Faltan datos obligatorios." });
    }

    // 2. Transacción
    const nuevaSolicitud = await prisma.$transaction(async (tx) => {
      
      const fechaActual = new Date();
      const year = fechaActual.getFullYear();
      
      const countYear = await tx.solicitud.count({
        where: {
          fecha: { 
            gte: new Date(`${year}-01-01`),
            lt: new Date(`${year + 1}-01-01`),
          },
        },
      });
      
      const correlativo = String(countYear + 1).padStart(4, "0");
      const codigoGenerado = `SOL-${year}-${correlativo}`;

      // Crear Cabecera
      const solicitud = await tx.solicitud.create({
        data: {
          id: codigoGenerado,
          solicitanteid: finalSolicitanteId,
          bodegaid: bodegaId,
          estado: "PENDIENTE",
          fecha: fechaActual 
        }
      });

      // Crear Items
      for (const item of items) {
        const prod = await tx.producto.findUnique({
             where: { id: item.productoId },
             select: { unidadid: true }
        });

        if (!prod) throw new Error(`Producto ${item.productoId} no encontrado`);

        await tx.solicitud_item.create({
          data: {
            solicitudid: solicitud.id,
            productoid: item.productoId,
            cantidad: item.cantidad,
            unidadid: prod.unidadid,
            notas: item.notas || null,
            loteid: item.loteId || null 
          }
        });
      }
      return solicitud;
    });

    // Devolvemos la estructura CORRECTA para que el frontend no falle al leer .id
    res.status(201).json({ ok: true, solicitud: nuevaSolicitud });

  } catch (error: any) {
    console.error("❌ Error al guardar solicitud:", error);
    res.status(500).json({ message: "Error interno al guardar", error: error.message });
  }
});

// ===============================
// PATCH /api/solicitudes/:id/estado
// ===============================
router.patch("/:id/estado", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { estado } = req.body; 
    const aprobadorId = req.user?.id; 

    const data = await solicitudesService.actualizarEstadoSolicitud(
      id,
      estado,
      aprobadorId 
    );
    res.json(data);
  } catch (error) {
    console.error("Error en PATCH /api/solicitudes/:id/estado:", error);
    res.status(500).json({ message: "Error al actualizar estado" });
  }
});

// ===============================
// GET /api/solicitudes/:id/export
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
// POST /api/solicitudes/:id/entregar
// (Este también necesita authenticateToken para saber quién entrega)
// ===============================
router.post("/:id/entregar", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const userId = req.user?.id; 

    if (!userId) {
        return res.status(401).json({ message: "No se pudo identificar al usuario que realiza la entrega." });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitud.findUnique({
        where: { id },
        include: { solicitud_item: true }
      });

      if (!solicitud) throw new Error("Solicitud no encontrada");
      if (solicitud.estado !== "APROBADA") throw new Error("La solicitud debe estar APROBADA para poder entregarse.");

      const fechaActual = new Date();
      const year = fechaActual.getFullYear();
      
      const countDocs = await tx.documento.count({
        where: {
          tipo: "SALIDA",
          fecha: {
            gte: new Date(`${year}-01-01`),
            lt: new Date(`${year + 1}-01-01`),
          }
        }
      });
      const correlativo = String(countDocs + 1).padStart(4, "0");
      const codigoDoc = `SAL-${year}-${correlativo}`;

      const documento = await tx.documento.create({
        data: {
          tipo: "SALIDA",
          estado: "APROBADO",
          fecha: fechaActual,
          creadorid: userId,
          bodegaorigenid: solicitud.bodegaid,
          solicitanteid: solicitud.solicitanteid,
          consecutivo: codigoDoc,
          observacion: `Generado automáticamente desde Solicitud ${solicitud.id}`
        }
      });

      for (const item of solicitud.solicitud_item) {
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

      const solicitudActualizada = await tx.solicitud.update({
        where: { id },
        data: {
          estado: "ENTREGADA",
          documentosalidaid: documento.id
        }
      });

      return { solicitud: solicitudActualizada, documentoId: documento.id, codigoDoc };
    });

    res.json(resultado);

  } catch (error: any) {
    console.error("Error en POST /api/solicitudes/:id/entregar:", error);
    res.status(500).json({ message: error.message || "Error al procesar la entrega" });
  }
});

export default router;