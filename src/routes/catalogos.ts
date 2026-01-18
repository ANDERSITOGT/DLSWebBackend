import { Router } from "express";
import prisma from "../prisma";

const router = Router();

// ===============================
// GET /api/catalogos/bodegas
// ===============================
router.get("/bodegas", async (req, res) => {
  try {
    // CORRECCIÓN: 'bodega' no tiene campo 'activo' en tu esquema.
    // Traemos todas ordenadas por nombre.
    const bodegas = await prisma.bodega.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true } 
    });
    res.json(bodegas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener bodegas" });
  }
});

// ===============================
// GET /api/catalogos/proveedores
// ===============================
router.get("/proveedores", async (req, res) => {
  try {
    // CORRECCIÓN: 'proveedor' no tiene campo 'activo'.
    const proveedores = await prisma.proveedor.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, nit: true }
    });
    res.json(proveedores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener proveedores" });
  }
});

// ===============================
// GET /api/catalogos/categorias
// ===============================
router.get("/categorias", async (req, res) => {
  try {
    const categorias = await prisma.categoria.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true }
    });
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener categorías" });
  }
});

// ===============================
// GET /api/catalogos/productos-busqueda
// (Autocompletado Rápido con Stock REAL - COMPROMETIDO)
// ===============================
router.get("/productos-busqueda", async (req, res) => {
  try {
    const term = req.query.q as string;
    
    // 1. Buscamos los productos
    // 'producto' SÍ tiene campo 'activo' en tu esquema.
    const productosRaw = await prisma.producto.findMany({
      where: {
        activo: true, 
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

    // 2. Calculamos el stock REAL (Físico - Comprometido)
    const productosConStock = await Promise.all(productosRaw.map(async (p) => {
        // A. Stock Físico (Entradas - Salidas Reales)
        const entradas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: {
                productoid: p.id,
                documento: { tipo: "INGRESO", estado: "APROBADO" }
            }
        });

        const salidas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: {
                productoid: p.id,
                documento: { tipo: "SALIDA", estado: "APROBADO" }
            }
        });

        const fisico = (Number(entradas._sum.cantidad) || 0) - (Number(salidas._sum.cantidad) || 0);

        // B. Stock Comprometido (Solicitudes Pendientes/Aprobadas NO entregadas)
        // OJO: No contamos ENTREGADA porque esa ya generó una SALIDA física (contada arriba).
        const comprometido = await prisma.solicitud_item.aggregate({
            _sum: { cantidad: true },
            where: {
                productoid: p.id,
                solicitud: {
                    estado: { in: ["PENDIENTE", "APROBADA"] }
                }
            }
        });
        
        const cantComprometida = Number(comprometido._sum.cantidad) || 0;
        
        // C. Disponible Real
        const disponible = fisico - cantComprometida;

        return {
            id: p.id,
            nombre: p.nombre,
            codigo: p.codigo,
            precioref: p.precioref,
            unidad: p.unidad,
            stockActual: disponible > 0 ? disponible : 0 // Si es negativo por error, mostramos 0
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
    // CORRECCIÓN: 'finca' no tiene campo 'activo'.
    const fincas = await prisma.finca.findMany({
      orderBy: { nombre: "asc" },
      include: {
        lote: {
          where: { estado: "ABIERTO" }, // 'lote' tiene estado enum ABIERTO/CERRADO
          select: { id: true, codigo: true, cultivo: { select: { nombre: true } } }
        }
      }
    });
    res.json(fincas);
  } catch (error) {
    console.error(error);
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

    // 'producto' SÍ tiene campo 'activo'
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
      take: 50 
    });

    // Mismo cálculo de stock (Físico - Comprometido)
    const productosConStock = await Promise.all(productosRaw.map(async (p) => {
        // A. Físico
        const entradas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { productoid: p.id, documento: { tipo: "INGRESO", estado: "APROBADO" } }
        });
        const salidas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { productoid: p.id, documento: { tipo: "SALIDA", estado: "APROBADO" } }
        });

        const fisico = (Number(entradas._sum.cantidad) || 0) - (Number(salidas._sum.cantidad) || 0);

        // B. Comprometido
        const comprometido = await prisma.solicitud_item.aggregate({
            _sum: { cantidad: true },
            where: {
                productoid: p.id,
                solicitud: {
                    estado: { in: ["PENDIENTE", "APROBADA"] }
                }
            }
        });
        
        const cantComprometida = Number(comprometido._sum.cantidad) || 0;
        const disponible = fisico - cantComprometida;

        return {
            ...p,
            stockActual: disponible > 0 ? disponible : 0
        };
    }));

    res.json(productosConStock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al buscar productos" });
  }
});

export default router;