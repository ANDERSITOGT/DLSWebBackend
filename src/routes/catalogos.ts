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
        // --- A. Stock Físico (Entradas - Salidas Reales + Ajustes) ---
        
        // 1. Ingresos (Suman)
        const ingresos = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { productoid: p.id, documento: { tipo: "INGRESO", estado: "APROBADO" } }
        });

        // 2. Salidas (Restan)
        const salidas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { productoid: p.id, documento: { tipo: "SALIDA", estado: "APROBADO" } }
        });

        // 3. Ajustes (Suman o Restan según signo guardado)
        const ajustes = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { productoid: p.id, documento: { tipo: "AJUSTE", estado: "APROBADO" } }
        });

        // 4. Devoluciones Internas (Reingreso a Bodega -> SUMAN)
        // Identificadas porque NO tienen proveedor
        const devInternas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { 
                productoid: p.id, 
                documento: { tipo: "DEVOLUCION", estado: "APROBADO", proveedorid: null } 
            }
        });

        // 5. Devoluciones Externas (Salida a Proveedor -> RESTAN)
        // Identificadas porque SÍ tienen proveedor
        const devExternas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { 
                productoid: p.id, 
                documento: { tipo: "DEVOLUCION", estado: "APROBADO", NOT: { proveedorid: null } } 
            }
        });

        const totalIngresos = (Number(ingresos._sum.cantidad) || 0) + (Number(devInternas._sum.cantidad) || 0);
        const totalSalidas = (Number(salidas._sum.cantidad) || 0) + (Number(devExternas._sum.cantidad) || 0);
        const totalAjustes = Number(ajustes._sum.cantidad) || 0; // Puede ser negativo

        const stockFisico = totalIngresos - totalSalidas + totalAjustes;


        // --- B. Stock Comprometido ---
        // Solo contamos solicitudes de tipo DESPACHO. Las de DEVOLUCION no restan stock.
        const comprometido = await prisma.solicitud_item.aggregate({
            _sum: { cantidad: true },
            where: {
                productoid: p.id,
                solicitud: {
                    estado: { in: ["PENDIENTE", "APROBADA"] },
                    tipo: "DESPACHO" // <--- NUEVO FILTRO IMPORTANTE
                }
            }
        });
        
        const cantComprometida = Number(comprometido._sum.cantidad) || 0;
        
        // C. Disponible Real
        const disponible = stockFisico - cantComprometida;

        return {
            id: p.id,
            nombre: p.nombre,
            codigo: p.codigo,
            precioref: p.precioref,
            unidad: p.unidad,
            stockActual: disponible > 0 ? disponible : 0
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
      orderBy: { nombre: "asc" },
      include: {
        lote: {
          where: { estado: "ABIERTO" },
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

    // Mismo cálculo de stock actualizado
    const productosConStock = await Promise.all(productosRaw.map(async (p) => {
        // A. Físico
        const ingresos = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { productoid: p.id, documento: { tipo: "INGRESO", estado: "APROBADO" } }
        });
        const salidas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { productoid: p.id, documento: { tipo: "SALIDA", estado: "APROBADO" } }
        });
        const ajustes = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { productoid: p.id, documento: { tipo: "AJUSTE", estado: "APROBADO" } }
        });
        const devInternas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { productoid: p.id, documento: { tipo: "DEVOLUCION", estado: "APROBADO", proveedorid: null } }
        });
        const devExternas = await prisma.documento_item.aggregate({
            _sum: { cantidad: true },
            where: { productoid: p.id, documento: { tipo: "DEVOLUCION", estado: "APROBADO", NOT: { proveedorid: null } } }
        });

        const totalIngresos = (Number(ingresos._sum.cantidad) || 0) + (Number(devInternas._sum.cantidad) || 0);
        const totalSalidas = (Number(salidas._sum.cantidad) || 0) + (Number(devExternas._sum.cantidad) || 0);
        const totalAjustes = Number(ajustes._sum.cantidad) || 0;

        const stockFisico = totalIngresos - totalSalidas + totalAjustes;

        // B. Comprometido (Solo DESPACHO)
        const comprometido = await prisma.solicitud_item.aggregate({
            _sum: { cantidad: true },
            where: {
                productoid: p.id,
                solicitud: {
                    estado: { in: ["PENDIENTE", "APROBADA"] },
                    tipo: "DESPACHO"
                }
            }
        });
        
        const cantComprometida = Number(comprometido._sum.cantidad) || 0;
        const disponible = stockFisico - cantComprometida;

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