// src/routes/solicitudes.ts
import { Router, Response } from "express";
import prisma from "../prisma"; 
import { authenticateToken, AuthRequest } from "../middlewares/auth";
import solicitudesService from "../services/solicitudesService";

const router = Router();

// ===============================
// GET /api/solicitudes
// ===============================
router.get("/", async (req, res) => {
  try {
    const { estado, mis } = req.query;
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
// POST /api/solicitudes (CORREGIDO SEGÚN SCHEMA)
// ===============================
router.post("/", async (req, res) => {
  console.log("📥 Recibiendo solicitud:", req.body); // LOG 1

  try {
    const { bodegaId, items, solicitanteId: bodySolicitanteId } = req.body;
    
    // 1. Identificar Usuario
    const user = (req as any).user;
    const finalSolicitanteId = user?.id ?? bodySolicitanteId;

    if (!finalSolicitanteId) {
        console.error("❌ Error: No se identificó al solicitante");
        return res.status(400).json({ message: "No se identificó al solicitante (Revisa tu login)" });
    }
    if (!bodegaId || !items || items.length === 0) {
        console.error("❌ Error: Faltan datos");
        return res.status(400).json({ message: "Faltan datos obligatorios." });
    }

    // 2. Transacción
    const nuevaSolicitud = await prisma.$transaction(async (tx) => {
      
      // A. Contar usando 'fecha' (Tu schema lo permite)
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

      console.log("🔹 Generando ID:", codigoGenerado); // LOG 2

      // B. Crear Cabecera (SOLO CAMPOS VÁLIDOS)
      const solicitud = await tx.solicitud.create({
        data: {
          id: codigoGenerado,
          solicitanteid: finalSolicitanteId,
          bodegaid: bodegaId,
          estado: "PENDIENTE",
          fecha: fechaActual 
          // ⚠️ IMPORTANTE: No enviamos 'observacion' porque no existe en tu tabla 'solicitud'
        }
      });

      // C. Crear Items
      for (const item of items) {
        // Verificar producto
        const prod = await tx.producto.findUnique({
             where: { id: item.productoId },
             select: { unidadid: true }
        });

        if (!prod) throw new Error(`Producto ${item.productoId} no encontrado en BD`);

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

    console.log("✅ Solicitud creada con éxito:", nuevaSolicitud.id); // LOG 3
    res.status(201).json({ ok: true, solicitud: nuevaSolicitud });

  } catch (error: any) {
    console.error("❌ ERROR CRÍTICO AL GUARDAR:", error); // LOG 4
    res.status(500).json({ message: "Error interno al guardar", error: error.message });
  }
});

// ===============================
// PATCH /api/solicitudes/:id/estado
// ===============================
router.patch("/:id/estado", async (req, res) => {
  try {
    const id = req.params.id;
    const { estado } = req.body; 
    const aprobadorId = (req as any).user?.id; 

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

export default router;