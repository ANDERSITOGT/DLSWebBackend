// src/routes/catalogos.ts
import { Router } from "express";
import prisma from "../prisma";

const router = Router();

// ===============================
// GET /api/catalogos/bodegas
// ===============================
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

// ===============================
// GET /api/catalogos/proveedores
// ===============================
router.get("/proveedores", async (req, res) => {
  try {
    const proveedores = await prisma.proveedor.findMany({
      select: { id: true, nombre: true, nit: true }
    });
    res.json(proveedores);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener proveedores" });
  }
});

// ===============================
// GET /api/catalogos/productos-busqueda
// (Autocompletado Rápido con Stock)
// ===============================
router.get("/productos-busqueda", async (req, res) => {
  try {
    const term = req.query.q as string;
    
    // 1. Buscamos los productos (sin select específico, traemos lo básico)
    const productosRaw = await prisma.producto.findMany({
      where: {
        ...(term ? {
          OR: [
            { nombre: { contains: term, mode: 'insensitive' } },
            { codigo: { contains: term, mode: 'insensitive' } }
          ]
        } : {})
      },
      take: 20, 
      include: {
          unidad: { select: { abreviatura: true } }
      }
    });

    // 2. Calculamos el stock para cada resultado
    const productosConStock = await Promise.all(productosRaw.map(async (p) => {
        // Sumar Entradas (Ingresos Aprobados)
        const entradas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: {
                productoid: p.id,
                documento: { tipo: "INGRESO", estado: "APROBADO" }
            }
        });

        // Sumar Salidas (Salidas Aprobadas)
        const salidas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: {
                productoid: p.id,
                documento: { tipo: "SALIDA", estado: "APROBADO" }
            }
        });

        const stock = (Number(entradas._sum.cantidad) || 0) - (Number(salidas._sum.cantidad) || 0);

        return {
            id: p.id,
            nombre: p.nombre,
            codigo: p.codigo,
            precioref: p.precioref,
            unidad: p.unidad,
            stockActual: stock // 👈 ¡EL DATO MÁGICO!
        };
    }));

    res.json(productosConStock);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al buscar productos" });
  }
});

// ===============================
// GET /api/catalogos/fincas-lotes
// ===============================
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

// ===============================
// GET /api/catalogos/productos/buscar
// (Búsqueda Completa con Stock)
// ===============================
router.get("/productos/buscar", async (req, res) => {
  try {
    const q = (req.query.q as string) || ""; 

    const productosRaw = await prisma.producto.findMany({
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
      orderBy: { nombre: 'asc' },
      take: 50 // Limitamos para no explotar el cálculo de stock si hay miles
    });

    // Mismo cálculo de stock
    const productosConStock = await Promise.all(productosRaw.map(async (p) => {
        const entradas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { productoid: p.id, documento: { tipo: "INGRESO", estado: "APROBADO" } }
        });
        const salidas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { productoid: p.id, documento: { tipo: "SALIDA", estado: "APROBADO" } }
        });

        const stock = (Number(entradas._sum.cantidad) || 0) - (Number(salidas._sum.cantidad) || 0);

        return {
            ...p,
            stockActual: stock
        };
    }));

    res.json(productosConStock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al buscar productos" });
  }
});

export default router;