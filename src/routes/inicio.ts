import { Router } from "express";
import { inicioService } from "../services/inicioService";

export const inicioRouter = Router();

inicioRouter.get("/bodeguero", async (req, res) => {
  try {
    const data = await inicioService.getBodegueroDashboard();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener dashboard bodeguero" });
  }
});

inicioRouter.get("/solicitante", async (req, res) => {
  const data = await inicioService.getSolicitanteDashboard();
  res.json(data);
});

inicioRouter.get("/admin", async (req, res) => {
  const data = await inicioService.getAdminDashboard();
  res.json(data);
});
