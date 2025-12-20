// src/routes/solicitudes.ts
import { Router } from "express";
import solicitudesService from "../services/solicitudesService";

const router = Router();

// ===============================
// GET /api/solicitudes
// ===============================
router.get("/", async (req, res) => {
  try {
    const { estado, mis } = req.query;

    // Cuando tengas auth, aquí usas el id del usuario del token.
    // De momento lo dejamos así, igual que hemos hecho en otros módulos.
    const solicitanteId =
      mis === "true" && req.user ? (req.user as any).id : undefined;

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
    const id = Number(req.params.id);
    const data = await solicitudesService.getDetalleSolicitud(id);
    res.json(data);
  } catch (error) {
    console.error("Error en GET /api/solicitudes/:id:", error);
    res.status(500).json({ message: "Error al obtener detalle de solicitud" });
  }
});

// ===============================
// POST /api/solicitudes
// ===============================
router.post("/", async (req, res) => {
  try {
    const body = req.body;

    // Si tienes middleware de auth, tomamos el solicitante del token:
    const solicitanteId = (req.user as any)?.id ?? body.solicitanteId;

    const data = await solicitudesService.crearSolicitud({
      ...body,
      solicitanteId,
    });

    res.status(201).json(data);
  } catch (error) {
    console.error("Error en POST /api/solicitudes:", error);
    res.status(500).json({ message: "Error al crear solicitud" });
  }
});

// ===============================
// PATCH /api/solicitudes/:id/estado
// ===============================
router.patch("/:id/estado", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { estado, comentarios } = req.body;

    const data = await solicitudesService.actualizarEstadoSolicitud(
      id,
      estado,
      comentarios
    );

    res.json(data);
  } catch (error) {
    console.error("Error en PATCH /api/solicitudes/:id/estado:", error);
    res
      .status(500)
      .json({ message: "Error al actualizar estado de solicitud" });
  }
});

// ===============================
// GET /api/solicitudes/:id/export
// ===============================
router.get("/:id/export", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { filename, mime, content } =
      await solicitudesService.exportSolicitudDetallePDF(id);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error("Error en GET /api/solicitudes/:id/export:", error);
    res.status(500).send("Error al exportar detalle de solicitud");
  }
});

export default router;
