import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middlewares/auth";
import productosService from "../services/productosService";

const router = Router();

// ==========================================
// POST /api/productos
// Crear un nuevo producto (Código Automático)
// ==========================================
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      nombre, 
      categoriaid, 
      unidadid, 
      ingredienteactivo, // 👈 Recibimos el nuevo campo
      precioref 
    } = req.body;

    // Validación de entrada (Ya no validamos 'codigo' porque lo generamos nosotros)
    if (!nombre || !categoriaid || !unidadid) {
      return res.status(400).json({ 
        message: "Faltan campos obligatorios: Nombre, Categoría o Unidad." 
      });
    }

    // Llamada al Servicio
    const nuevoProducto = await productosService.createProducto({
      nombre,
      categoriaid,
      unidadid,
      ingredienteactivo,
      precioref: precioref ? Number(precioref) : undefined
    });

    res.status(201).json(nuevoProducto);

  } catch (error: any) {
    console.error("❌ Error en POST /productos:", error.message);
    res.status(500).json({ message: "Error interno al crear producto." });
  }
});

export default router;