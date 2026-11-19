// src/modules/dashboard/inicio.ts
// @deprecated Router legacy. La fuente oficial del home es /api/dashboard.
// Solo queda viva la ruta /solicitante hasta que el frontend migre y producto
// autorice el sunset definitivo (borrado de este archivo + su registro en index.ts).
//
// Rutas eliminadas (codigo muerto, migradas a /api/dashboard):
//  - /bodeguero -> ahora /api/dashboard?modulo=BODEGA (ADMIN, BODEGUERO)
//  - /admin     -> ahora /api/dashboard?modulo=BODEGA (ADMIN)
import { Router } from "express";
import { inicioService } from "./inicioService";
import { requireRole } from "../../core/middlewares/roles";

const router = Router();

// Nota: `authenticateToken` se aplica a nivel de app.use("/api/inicio", ...)
// en src/index.ts, por lo que aqui solo validamos el rol con `requireRole`.

// /api/inicio/solicitante  @deprecated -> usar /api/dashboard?modulo=BODEGA
router.get(
  "/solicitante",
  requireRole("ADMIN", "SOLICITANTE", "VISOR"),
  async (req, res) => {
    try {
      const data = await inicioService.getSolicitanteDashboard();
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al obtener dashboard solicitante" });
    }
  }
);

export default router;
