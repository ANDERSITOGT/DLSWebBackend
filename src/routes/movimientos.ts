// src/routes/movimientos.ts
import { Router } from "express";
import { movimientosService } from "../services/movimientosService";

const router = Router();

// ================================
// LISTADO DE DOCUMENTOS (tarjetas Movimientos)
// GET /api/movimientos
// ================================
router.get("/", async (req, res) => {
  try {
    const data = await movimientosService.getListadoMovimientos();
    res.json({ movimientos: data });
  } catch (error) {
    console.error("Error en GET /api/movimientos:", error);
    res
      .status(500)
      .json({ message: "Error al obtener movimientos" });
  }
});

// ================================
// LISTADO DE LOTES (tarjetas Lotes)
// GET /api/movimientos/lotes
// ================================
router.get("/lotes", async (req, res) => {
  try {
    const data = await movimientosService.getListadoLotes();
    res.json({ lotes: data });
  } catch (error) {
    console.error("Error en GET /api/movimientos/lotes:", error);
    res.status(500).json({ message: "Error al obtener lotes" });
  }
});

// ================================
// DETALLE DE LOTE (modal de Lotes)
// GET /api/movimientos/lotes/:id
// ================================
router.get("/lotes/:id", async (req, res) => {
  try {
    const loteId = req.params.id;
    const data = await movimientosService.getDetalleLote(loteId);
    res.json(data);
  } catch (error) {
    console.error(
      "Error en GET /api/movimientos/lotes/:id:",
      error
    );
    res.status(500).json({ message: "Error al obtener lote" });
  }
});

// ================================
// EXPORT HISTORIAL DE LOTE (PDF)
// GET /api/movimientos/lotes/:id/export
// ================================
router.get("/lotes/:id/export", async (req, res) => {
  try {
    const loteId = req.params.id;
    const { filename, mime, content } =
      await movimientosService.exportHistorialLotePDF(loteId);

    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.send(content);
  } catch (error) {
    console.error(
      "Error en GET /api/movimientos/lotes/:id/export:",
      error
    );
    res
      .status(500)
      .send("Error al exportar historial de aplicaciones del lote");
  }
});

// ================================
// EXPORT LISTADO DE MOVIMIENTOS (PDF)
// GET /api/movimientos/export
// ================================
router.get("/export", async (req, res) => {
  try {
    const { filename, mime, content } =
      await movimientosService.exportListadoMovimientosPDF();

    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.send(content);
  } catch (error) {
    console.error("Error en GET /api/movimientos/export:", error);
    res
      .status(500)
      .send("Error al exportar listado de movimientos");
  }
});

// ================================
// DETALLE DE DOCUMENTO / MOVIMIENTO
// GET /api/movimientos/:id
// ================================
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const data = await movimientosService.getDetalleMovimiento(id);
    res.json(data);
  } catch (error) {
    console.error("Error en GET /api/movimientos/:id:", error);
    res
      .status(500)
      .json({ message: "Error al obtener detalle de movimiento" });
  }
});

// ================================
// EXPORT DETALLE DE DOCUMENTO (PDF)
// GET /api/movimientos/:id/export
// ================================
router.get("/:id/export", async (req, res) => {
  try {
    const id = req.params.id;
    const { filename, mime, content } =
      await movimientosService.exportMovimientoDetallePDF(id);

    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.send(content);
  } catch (error) {
    console.error("Error en GET /api/movimientos/:id/export:", error);
    res
      .status(500)
      .send("Error al exportar detalle de movimiento");
  }
});

export default router;
