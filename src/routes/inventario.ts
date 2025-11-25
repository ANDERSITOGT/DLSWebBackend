// src/routes/inventario.ts
import { Router } from "express";
import PDFDocument from "pdfkit";
import { inventarioService } from "../services/inventarioService";

const router = Router();

// ==========================
//  GET /api/inventario
//  Listado para la pantalla
// ==========================
router.get("/", async (req, res) => {
  try {
    const productos = await inventarioService.getListadoProductos();
    res.json({ productos });
  } catch (error) {
    console.error("Error en GET /api/inventario:", error);
    res.status(500).json({ message: "Error al obtener inventario" });
  }
});

// ====================================
//  GET /api/inventario/categorias
//  (para el filtro de categorías)
// ====================================
router.get("/categorias", async (req, res) => {
  try {
    const categorias = await inventarioService.getCategorias();
    res.json({ categorias });
  } catch (error) {
    console.error("Error en GET /api/inventario/categorias:", error);
    res.status(500).json({ message: "Error al obtener categorías" });
  }
});

// ====================================
//  NUEVO: GET /api/inventario/pdf
//  Reporte completo en PDF (SIN filtros)
// ====================================
router.get("/pdf", async (req, res) => {
  try {
    const productos = await inventarioService.getListadoProductos();

    // Ordenamos por CATEGORÍA y luego por NOMBRE
    const ordenados = [...productos].sort((a, b) => {
      const catA = (a.categoria || "").toLowerCase();
      const catB = (b.categoria || "").toLowerCase();
      if (catA < catB) return -1;
      if (catA > catB) return 1;

      const nomA = a.nombre.toLowerCase();
      const nomB = b.nombre.toLowerCase();
      if (nomA < nomB) return -1;
      if (nomA > nomB) return 1;
      return 0;
    });

    // Cabeceras HTTP
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="inventario.pdf"'
    );

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    // ----- Encabezado -----
    doc.fontSize(16).text("REPORTE DE INVENTARIO", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text("Listado general de productos", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(8)
      .text(`Generado: ${new Date().toLocaleString("es-GT")}`, {
        align: "center",
      });
    doc.moveDown(1);

    // ----- Configuración de tabla -----
    const marginLeft = 40;
    const colCodigoWidth = 80;
    const colNombreWidth = 220;
    const colCategoriaWidth = 140;
    const colStockWidth = 80;
    const rowHeight = 16;
    const pageBottom = doc.page.height - 50;

    const drawTableHeader = () => {
      let y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9);

      doc.text("Código", marginLeft, y, { width: colCodigoWidth });
      doc.text("Nombre del producto", marginLeft + colCodigoWidth, y, {
        width: colNombreWidth,
      });
      doc.text(
        "Categoría",
        marginLeft + colCodigoWidth + colNombreWidth,
        y,
        { width: colCategoriaWidth }
      );
      doc.text(
        "Stock total",
        marginLeft + colCodigoWidth + colNombreWidth + colCategoriaWidth,
        y,
        { width: colStockWidth }
      );

      y += rowHeight - 4;
      doc
        .moveTo(marginLeft, y)
        .lineTo(
          marginLeft +
            colCodigoWidth +
            colNombreWidth +
            colCategoriaWidth +
            colStockWidth,
          y
        )
        .strokeColor("#cccccc")
        .lineWidth(0.5)
        .stroke();
      doc.strokeColor("black");

      doc.moveDown(0.3);
    };

    // Dibujamos encabezado inicial de la tabla
    drawTableHeader();
    doc.font("Helvetica").fontSize(8);
    let y = doc.y;

    // ----- Filas -----
    for (const p of ordenados) {
      // Salto de página si no cabe la siguiente fila
      if (y + rowHeight > pageBottom) {
        doc.addPage();
        doc.y = 50;
        drawTableHeader();
        doc.font("Helvetica").fontSize(8);
        y = doc.y;
      }

      doc.text(p.codigo, marginLeft, y, { width: colCodigoWidth });
      doc.text(p.nombre, marginLeft + colCodigoWidth, y, {
        width: colNombreWidth,
      });
      doc.text(
        p.categoria,
        marginLeft + colCodigoWidth + colNombreWidth,
        y,
        { width: colCategoriaWidth }
      );
      doc.text(
        p.stockTotal,
        marginLeft + colCodigoWidth + colNombreWidth + colCategoriaWidth,
        y,
        { width: colStockWidth }
      );

      y += rowHeight;
      doc.y = y;
    }

    doc.end();
  } catch (error) {
    console.error("Error generando PDF de inventario:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error al generar el PDF" });
    }
  }
});

// ====================================
//  GET /api/inventario/:id
//  Detalle de un producto (modal)
// ====================================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const detalle = await inventarioService.getDetalleProducto(id);
    res.json(detalle);
  } catch (error) {
    console.error("Error en GET /api/inventario/:id:", error);
    res.status(500).json({ message: "Error al obtener detalle de producto" });
  }
});

export default router;
