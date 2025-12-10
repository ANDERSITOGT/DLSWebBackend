// src/routes/movimientos.ts
import { Router } from "express";
import { movimientosService } from "../services/movimientosService";

const router = Router();

// ============================================
// LISTADO DE DOCUMENTOS / MOVIMIENTOS
// GET /api/movimientos
// ============================================
router.get("/", async (req, res) => {
  try {
    const movimientos = await movimientosService.getListadoMovimientos();
    res.json({ movimientos });
  } catch (error) {
    console.error("Error en GET /api/movimientos:", error);
    res.status(500).json({ message: "Error al obtener movimientos" });
  }
});

// ============================================
// LISTADO DE LOTES (tarjetas Lotes)
// GET /api/movimientos/lotes
// ============================================
router.get("/lotes", async (req, res) => {
  try {
    const lotes = await movimientosService.getListadoLotes();
    res.json({ lotes });
  } catch (error) {
    console.error("Error en GET /api/movimientos/lotes:", error);
    res.status(500).json({ message: "Error al obtener lotes" });
  }
});

// ============================================
// DETALLE DE LOTE (modal Lote)
// GET /api/movimientos/lotes/:id
// ============================================
router.get("/lotes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const detalle = await movimientosService.getDetalleLote(id);
    res.json(detalle);
  } catch (error) {
    console.error("Error en GET /api/movimientos/lotes/:id:", error);
    res.status(500).json({ message: "Error al obtener detalle del lote" });
  }
});

// ============================================
// DETALLE DE DOCUMENTO / MOVIMIENTO (modal)
// GET /api/movimientos/:id
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const detalle = await movimientosService.getDetalleMovimiento(id);
    res.json(detalle);
  } catch (error) {
    console.error("Error en GET /api/movimientos/:id:", error);
    res
      .status(500)
      .json({ message: "Error al obtener detalle del movimiento" });
  }
});

export default router;
