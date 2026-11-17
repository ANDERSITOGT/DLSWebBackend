import { Response, Router } from "express";
import { authenticateToken, AuthRequest } from "../../core/middlewares/auth";
import {
  dashboardService,
  DashboardForbiddenError,
  ModuloDashboard,
} from "./dashboardService";

const router = Router();

// GET /api/dashboard?modulo=BODEGA|COSECHAS&dias=7
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const moduloQuery = String(req.query.modulo ?? "BODEGA").toUpperCase();
    if (moduloQuery !== "BODEGA" && moduloQuery !== "COSECHAS") {
      return res.status(400).json({ message: "Módulo inválido. Use BODEGA o COSECHAS." });
    }

    const diasParsed = parseInt(String(req.query.dias ?? "7"), 10);
    const dias = Number.isNaN(diasParsed) ? 7 : Math.min(Math.max(diasParsed, 1), 90);

    const data = await dashboardService.getDashboard(
      { id: req.user.id, rol: req.user.rol },
      moduloQuery as ModuloDashboard,
      dias
    );
    res.json(data);
  } catch (error) {
    if (error instanceof DashboardForbiddenError) {
      return res.status(403).json({ message: error.message });
    }
    console.error("Error en GET /api/dashboard:", error);
    res.status(500).json({ message: "Error al obtener el dashboard" });
  }
});

export default router;
