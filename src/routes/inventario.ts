import { Router } from "express";
import PDFDocument from "pdfkit";
import { inventarioService } from "../services/inventarioService";

const router = Router();

// ==========================
//  GET /api/inventario
//  Soporta: ?limit=30, ?search=abc, ?categoria=xyz
// ==========================
router.get("/", async (req, res) => {
  try {
    const limitQuery = req.query.limit as string;
    const search = req.query.search as string;
    const categoria = req.query.categoria as string;

    // Si limit es 'all', mandamos undefined (sin límite), si no, un número (default 30)
    let limit: number | undefined = 30;
    if (limitQuery === 'all') {
        limit = undefined; 
    } else if (limitQuery) {
        limit = parseInt(limitQuery);
    }

    const productos = await inventarioService.getListadoProductos({ 
        limit, 
        search, 
        categoria 
    });
    
    res.json({ productos });
  } catch (error) {
    console.error("Error en GET /api/inventario:", error);
    res.status(500).json({ message: "Error al obtener inventario" });
  }
});

// ====================================
//  GET /api/inventario/categorias
// ====================================
router.get("/categorias", async (req, res) => {
  try {
    const categorias = await inventarioService.getCategorias();
    res.json({ categorias });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
});

// ====================================
//  GET /api/inventario/pdf
// ====================================
router.get("/pdf", async (req, res) => {
  try {
    // Para el PDF queremos todo, sin límite
    const productos = await inventarioService.getListadoProductos({ limit: undefined });

    // Ordenamos por Categoría para el reporte
    const ordenados = [...productos].sort((a, b) => a.categoria.localeCompare(b.categoria));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="inventario.pdf"');

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    doc.fontSize(16).text("REPORTE DE INVENTARIO", { align: "center" });
    doc.moveDown();
    
    // Tabla simple
    ordenados.forEach(p => {
        doc.fontSize(10).text(`${p.codigo} - ${p.nombre}`);
        doc.fontSize(8).text(`Categoría: ${p.categoria} | Stock: ${p.stockTotal}`);
        doc.moveDown(0.5);
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ message: "Error al generar el PDF" });
  }
});

// ====================================
//  GET /api/inventario/:id (Detalle)
// ====================================
router.get("/:id", async (req, res) => {
  try {
    const detalle = await inventarioService.getDetalleProducto(req.params.id);
    res.json(detalle);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener detalle" });
  }
});

export default router;