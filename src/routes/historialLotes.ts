import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middlewares/auth";
import { lotesService } from "../services/historialLotesService";

const router = Router();

// GET /api/lotes -> Dashboard Agrupado
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const usuario = { id: req.user!.id, rol: req.user!.rol };
    const data = await lotesService.getLotesDashboard(usuario);
    res.json(data);
  } catch (error) {
    console.error("Error obteniendo lotes:", error);
    res.status(500).json({ message: "Error al cargar el dashboard de lotes." });
  }
});

// GET /api/lotes/:id -> Detalle Completo
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const usuario = { id: req.user!.id, rol: req.user!.rol };
    const data = await lotesService.getDetalleLoteFull(req.params.id, usuario);
    res.json(data);
  } catch (error: any) {
    // Si el error es de permisos (403 simulado) o no encontrado (404)
    if (error.message.includes("acceso")) return res.status(403).json({ message: error.message });
    if (error.message.includes("encontrado")) return res.status(404).json({ message: error.message });
    
    console.error("Error detalle lote:", error);
    res.status(500).json({ message: "Error al cargar detalle del lote." });
  }
});

// GET /api/lotes/:id/export -> PDF
router.get("/:id/export", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const usuario = { id: req.user!.id, rol: req.user!.rol };
    const { filename, mime, content } = await lotesService.exportLotePDF(req.params.id, usuario);
    
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error("Error exportando lote:", error);
    res.status(500).send("Error al generar PDF.");
  }
});

export default router;