import { Router } from "express";
// Asegúrate de que solicitudesService tenga un 'export default' o usa { ... } si son exports nombrados
import solicitudesService from "../services/solicitudesService";

const router = Router();

// ===============================
// GET /api/solicitudes
// ===============================
router.get("/", async (req, res) => {
  try {
    const { estado, mis } = req.query;

    // CORRECCIÓN 1: TypeScript no sabe qué es 'req.user', usamos (req as any)
    const user = (req as any).user;
    
    // Si 'mis' es true y existe el usuario, usamos su ID
    const solicitanteId =
      mis === "true" && user ? user.id : undefined;

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
    // CORRECCIÓN 2: Tu ID en Prisma es un String (UUID), NO un Number.
    const id = req.params.id; 
    
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

    // CORRECCIÓN: Usamos (req as any) para acceder al usuario
    const user = (req as any).user;
    const solicitanteId = user?.id ?? body.solicitanteId;

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
    // CORRECCIÓN: ID como String
    const id = req.params.id;
    // CORRECCIÓN SUGERIDA PARA EL ROUTE
    const { estado } = req.body; 
    // Obtenemos el ID del usuario actual (si existe) para marcar quién aprobó
    const aprobadorId = (req as any).user?.id; 

    const data = await solicitudesService.actualizarEstadoSolicitud(
      id,
      estado,
      aprobadorId // Ahora sí pasamos un ID de usuario, no un texto de comentario
    );

    res.json(data);
  } catch (error) {
    console.error("Error en PATCH /api/solicitudes/:id/estado:", error);
    res.status(500).json({ message: "Error al actualizar estado de solicitud" });
  }
});

// ===============================
// GET /api/solicitudes/:id/export
// ===============================
router.get("/:id/export", async (req, res) => {
  try {
    // CORRECCIÓN: ID como String
    const id = req.params.id;
    
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