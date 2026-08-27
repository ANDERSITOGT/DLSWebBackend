import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middlewares/auth";
import productosService from "../services/productosService";

const router = Router();

// ==========================================
// POST /api/productos
// Crear un nuevo producto (Codigo Automatico)
// ==========================================
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      nombre, 
      categoriaid, 
      unidadid, 
      ingredienteactivo,
      precioref,
      dosis_200lt,
      comentarioDosis
    } = req.body;

    // Validacion de entrada (Ya no validamos 'codigo' porque lo generamos nosotros)
    if (!nombre || !categoriaid || !unidadid) {
      return res.status(400).json({ 
        message: "Faltan campos obligatorios: Nombre, Categoria o Unidad." 
      });
    }

    // Llamada al Servicio
    const nuevoProducto = await productosService.createProducto({
      nombre,
      categoriaid,
      unidadid,
      ingredienteactivo,
      precioref: precioref !== undefined ? Number(precioref) : undefined,
      dosis_200lt: dosis_200lt !== undefined ? Number(dosis_200lt) : undefined,
      comentarioDosis
    });

    res.status(201).json(nuevoProducto);

  } catch (error: any) {
    console.error("Error en POST /productos:", error.message);
    res.status(500).json({ message: "Error interno al crear producto." });
  }
});

// ==========================================
// PATCH /api/productos/:id
// Actualizar la informacion de un producto
// ==========================================
router.patch("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      codigo,
      categoriaid,
      unidadid,
      ingredienteactivo,
      precioref,
      dosis_200lt,
      comentarioDosis,
      activo
    } = req.body;

    const productoActualizado = await productosService.updateProducto(id, {
      nombre,
      codigo,
      categoriaid,
      unidadid,
      ingredienteactivo,
      precioref: precioref !== undefined ? Number(precioref) : undefined,
      dosis_200lt: dosis_200lt !== undefined ? Number(dosis_200lt) : undefined,
      comentarioDosis,
      activo
    });

    res.json(productoActualizado);

  } catch (error: any) {
    // Si el error es el que programamos por codigo duplicado, enviamos un estado 400
    if (error.message && error.message.includes("ya esta en uso")) {
      return res.status(400).json({ message: error.message });
    }

    console.error("Error en PATCH /productos/:id:", error.message);
    res.status(500).json({ message: "Error interno al actualizar el producto." });
  }
});

export default router;