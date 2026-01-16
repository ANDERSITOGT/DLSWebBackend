// src/routes/catalogos.ts
import { Router } from "express";
import prisma from "../prisma";

const router = Router();

// GET /api/catalogos/bodegas
router.get("/bodegas", async (req, res) => {
  try {
    const bodegas = await prisma.bodega.findMany({
      select: { id: true, nombre: true } 
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
      // 👇 AGREGADO: 'nit' (Para que el modal de Ingreso lo muestre)
      select: { id: true, nombre: true, nit: true }
    });
    res.json(proveedores);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener proveedores" });
  }
});

// GET /api/catalogos/productos-busqueda
// Usaremos esto para el autocompletado rápido
router.get("/productos-busqueda", async (req, res) => {
  try {
    const term = req.query.q as string;
    const productos = await prisma.producto.findMany({
      where: {
        ...(term ? {
          OR: [
            { nombre: { contains: term, mode: 'insensitive' } },
            { codigo: { contains: term, mode: 'insensitive' } }
          ]
        } : {})
      },
      take: 20, 
      select: { 
        id: true, 
        nombre: true, 
        codigo: true, 
        // 👇 AGREGADO: 'precioref' (Para pre-llenar el costo)
        precioref: true,
        unidad: { select: { abreviatura: true } } 
      }
    });
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: "Error al buscar productos" });
  }
});

// GET /api/catalogos/fincas-lotes
router.get("/fincas-lotes", async (req, res) => {
  try {
    const fincas = await prisma.finca.findMany({
      include: {
        lote: {
          where: { estado: "ABIERTO" }, 
          select: { id: true, codigo: true, cultivo: { select: { nombre: true } } }
        }
      }
    });
    res.json(fincas);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener fincas y lotes" });
  }
});

// GET /api/catalogos/productos/buscar
// (Búsqueda completa, este ya trae todo por defecto con 'include')
router.get("/productos/buscar", async (req, res) => {
  try {
    const q = (req.query.q as string) || ""; 

    const productos = await prisma.producto.findMany({
      where: {
        AND: [
          { activo: true }, 
          {
            OR: [
              { nombre: { contains: q, mode: "insensitive" } },
              { codigo: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      include: {
        unidad: true,
      },
      orderBy: { nombre: 'asc' } 
    });

    res.json(productos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al buscar productos" });
  }
});

export default router;