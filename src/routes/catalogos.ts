import { Router } from "express";
import prisma from "../prisma";

const router = Router();

// GET /api/catalogos/bodegas
router.get("/bodegas", async (req, res) => {
  try {
    const bodegas = await prisma.bodega.findMany({
      select: { id: true, nombre: true } // Solo traemos lo necesario
    });
    res.json(bodegas);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener bodegas" });
  }
});

// GET /api/catalogos/proveedores
router.get("/proveedores", async (req, res) => {
  try {
    const proveedores = await prisma.proveedor.findMany({
      select: { id: true, nombre: true }
    });
    res.json(proveedores);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener proveedores" });
  }
});

// GET /api/catalogos/productos-busqueda
// Usaremos esto para el autocompletado
router.get("/productos-busqueda", async (req, res) => {
  try {
    const term = req.query.q as string;
    const productos = await prisma.producto.findMany({
      where: {
        // Si hay término de búsqueda, filtramos. Si no, traemos los primeros 20.
        ...(term ? {
          OR: [
            { nombre: { contains: term, mode: 'insensitive' } },
            { codigo: { contains: term, mode: 'insensitive' } }
          ]
        } : {})
      },
      take: 20, // Limitamos a 20 para no saturar
      select: { 
        id: true, 
        nombre: true, 
        codigo: true, 
        unidad: { select: { abreviatura: true } } // Necesitamos saber la unidad
      }
    });
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: "Error al buscar productos" });
  }
});


// GET /api/catalogos/fincas-lotes
// Devuelve fincas con sus lotes activos para los selectores en cascada
router.get("/fincas-lotes", async (req, res) => {
  try {
    const fincas = await prisma.finca.findMany({
      include: {
        lote: {
          where: { estado: "ABIERTO" }, // Solo lotes activos
          select: { id: true, codigo: true, cultivo: { select: { nombre: true } } }
        }
      }
    });
    res.json(fincas);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener fincas y lotes" });
  }
});

export default router;