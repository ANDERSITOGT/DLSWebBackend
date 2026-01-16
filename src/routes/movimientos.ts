// src/routes/movimientos.ts
import { Router, Response } from "express";
import prisma from "../prisma";
import { authenticateToken, AuthRequest } from "../middlewares/auth";
import { movimientosService } from "../services/movimientosService";

const router = Router();

// ==========================================
// NUEVO: REGISTRAR INGRESO
// POST /api/movimientos/ingreso
// ==========================================
router.post("/ingreso", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      bodegaId, 
      proveedorId, 
      fecha, 
      factura, 
      observaciones, 
      items 
    } = req.body;

    // 1. Validaciones básicas
    if (!bodegaId || !items || items.length === 0) {
      return res.status(400).json({ message: "Faltan datos obligatorios (bodega o productos)." });
    }

    // Obtenemos el ID del usuario desde el token
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ message: "Error de identidad de usuario" });

    // 2. Transacción de Base de Datos
    const resultado = await prisma.$transaction(async (tx) => {
      
      // A. Crear el Documento Principal
      const documento = await tx.documento.create({
        data: {
          tipo: "INGRESO",
          estado: "APROBADO",
          
          // ✅ CORRECCIÓN APLICADA:
          // Si la fecha viene vacía o inválida, usa la fecha actual automáticamente.
          fecha: fecha ? new Date(fecha) : new Date(),
          
          bodegadestinoid: bodegaId,
          proveedorid: proveedorId || null,
          creadorid: userId,
          observacion: factura 
            ? `[Factura: ${factura}] ${observaciones || ""}` 
            : observaciones,
        },
      });

      // B. Crear los Items
      for (const item of items) {
        // Buscamos info del producto (principalmente la unidad)
        const productoInfo = await tx.producto.findUnique({
            where: { id: item.productoId }
        });

        if (!productoInfo) throw new Error(`Producto ${item.productoId} no encontrado`);

        await tx.documento_item.create({
          data: {
            documentoid: documento.id,
            productoid: item.productoId,
            cantidad: item.cantidad,
            costounit: item.costo,
            unidadid: productoInfo.unidadid,
            loteid: item.loteId || null
          },
        });
      }

      return documento;
    });

    res.json({ ok: true, documento: resultado, message: "Ingreso registrado correctamente" });

  } catch (error: any) {
    console.error("Error al crear ingreso:", error);
    res.status(500).json({ message: "Error interno al guardar el ingreso", error: error.message });
  }
});

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
    res.status(500).json({ message: "Error al obtener movimientos" });
  }
});

// ================================
// EXPORT LISTADO DE MOVIMIENTOS (PDF)
// GET /api/movimientos/export
// ================================
router.get("/export", async (req, res) => {
  try {
    const { filename, mime, content } = await movimientosService.exportListadoMovimientosPDF();

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error("Error en GET /api/movimientos/export:", error);
    res.status(500).send("Error al exportar listado de movimientos");
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
    console.error("Error en GET /api/movimientos/lotes/:id:", error);
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
    const { filename, mime, content } = await movimientosService.exportHistorialLotePDF(loteId);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error("Error en GET /api/movimientos/lotes/:id/export:", error);
    res.status(500).send("Error al exportar historial de aplicaciones del lote");
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
    res.status(500).json({ message: "Error al obtener detalle de movimiento" });
  }
});

// ================================
// EXPORT DETALLE DE DOCUMENTO (PDF)
// GET /api/movimientos/:id/export
// ================================
router.get("/:id/export", async (req, res) => {
  try {
    const id = req.params.id;
    const { filename, mime, content } = await movimientosService.exportMovimientoDetallePDF(id);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error("Error en GET /api/movimientos/:id/export:", error);
    res.status(500).send("Error al exportar detalle de movimiento");
  }
});

export default router;