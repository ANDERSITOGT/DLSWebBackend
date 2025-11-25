// src/routes/inicio.ts
import { Router } from "express";
import { inicioService } from "../services/inicioService";

const router = Router();

// /api/inicio/bodeguero
router.get("/bodeguero", async (req, res) => {
  try {
    const data = await inicioService.getBodegueroDashboard();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener dashboard bodeguero" });
  }
});

// /api/inicio/solicitante
router.get("/solicitante", async (req, res) => {
  try {
    const data = await inicioService.getSolicitanteDashboard();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener dashboard solicitante" });
  }
});

// /api/inicio/admin
router.get("/admin", async (req, res) => {
  try {
    const data = await inicioService.getAdminDashboard();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener dashboard admin" });
  }
});

export default router;
