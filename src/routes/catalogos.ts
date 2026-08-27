import { Router, Response } from "express";
import prisma from "../prisma";
import { authenticateToken, AuthRequest } from "../middlewares/auth";
import lotesService from "../services/lotesService"; 

const router = Router();

console.log("✅ Rutas de Catálogos Cargadas en Memoria");

// ===============================
// GET /api/catalogos/lotes
// ===============================
router.get("/lotes", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const usuarioId = req.user?.id;
        const usuarioRol = req.user?.rol;
        const lotes = await lotesService.getLotes(usuarioId, usuarioRol);
        res.json(lotes);
    } catch (error) {
        console.error("❌ Error en /lotes:", error);
        res.status(500).json({ error: "Error al obtener lotes" });
    }
});


// ===============================
// GET /api/catalogos/fincas-lotes
// ===============================

router.get("/fincas-lotes", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const usuarioId = req.user?.id;
    const usuarioRol = req.user?.rol;

    // 1. Filtro Base: Solo lotes ABIERTOS (Activos)
    let loteWhere: any = { 
        estado: "ABIERTO" 
    };

    // 2. Filtro de Seguridad: Si es SOLICITANTE, solo sus asignados
    if (usuarioRol === "SOLICITANTE" && usuarioId) {
       loteWhere.encargados = {
         some: { usuarioid: usuarioId }
       };
    }

    const fincas = await prisma.finca.findMany({
      orderBy: { nombre: "asc" },
      include: {
        lote: {
          where: loteWhere, // 👈 Aquí aplicamos el filtro inteligente
          select: { 
              id: true, 
              codigo: true, 
              // Incluimos cultivo para mostrar "LOTE X - FRESA" en el select
              cultivo: { select: { nombre: true } } 
          }
        }
      }
    });

    // 3. Limpieza: Solo devolvemos fincas que tengan al menos un lote visible
    const fincasVisibles = fincas
        .map(f => ({
            ...f,
            // Aseguramos que la lista de lotes esté limpia (aunque el include ya lo hace, esto previene nulos)
            lote: f.lote || [] 
        }))
        .filter(f => f.lote.length > 0);

    res.json(fincasVisibles);

  } catch (error) {
    console.error("❌ Error en /fincas-lotes:", error);
    res.status(500).json({ error: "Error al obtener fincas y lotes" });
  }
});



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
// GET /api/catalogos/unidades
// ===============================
router.get("/unidades", async (req, res) => {
    try {
      const unidades = await prisma.unidad.findMany({
        orderBy: { nombre: "asc" },
        select: { id: true, nombre: true, abreviatura: true }
      });
      res.json(unidades);
    } catch (error) {
      console.error("❌ Error en /unidades:", error);
      res.status(500).json({ error: "Error al obtener unidades de medida" });
    }
});

// ===============================
// GET /api/catalogos/productos-busqueda
// ===============================
router.get("/productos-busqueda", async (req, res) => {
  try {
    const term = req.query.q as string;
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
          // ✅ Mantenemos esto que arreglaba el nombre en la lista
          unidad: { 
              select: { id: true, nombre: true, abreviatura: true } 
          } 
      }
    });

    const productosConStock = await Promise.all(productosRaw.map(async (p) => {
        const ingresos = await prisma.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: p.id, documento: { tipo: "INGRESO", estado: "APROBADO" } } });
        const salidas = await prisma.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: p.id, documento: { tipo: "SALIDA", estado: "APROBADO" } } });
        const ajustes = await prisma.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: p.id, documento: { tipo: "AJUSTE", estado: "APROBADO" } } });
        const devIn = await prisma.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: p.id, documento: { tipo: "DEVOLUCION", estado: "APROBADO", proveedorid: null } } });
        const devOut = await prisma.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: p.id, documento: { tipo: "DEVOLUCION", estado: "APROBADO", NOT: { proveedorid: null } } } });

        const stockFisico = ((Number(ingresos._sum.cantidad) || 0) + (Number(devIn._sum.cantidad) || 0) + (Number(ajustes._sum.cantidad) || 0)) - ((Number(salidas._sum.cantidad) || 0) + (Number(devOut._sum.cantidad) || 0));

        // 👇 CÓDIGO CORREGIDO AQUÍ ABAJO
        // Se eliminó la línea 'tipo: "DESPACHO"' para evitar el error de columna inexistente
        const comprometido = await prisma.solicitud_item.aggregate({
            _sum: { cantidad: true },
            where: { 
                productoid: p.id, 
                solicitud: { 
                    estado: { in: ["PENDIENTE", "APROBADA"] }
                    // ⚠️ IMPORTANTE: Cuando actualices tu BD, descomenta la siguiente línea:
                    // tipo: "DESPACHO" 
                } 
            }
        });
        
        const cantComprometida = Number(comprometido._sum.cantidad) || 0;
        const disponible = stockFisico - cantComprometida;

        return {
            id: p.id,
            nombre: p.nombre,
            codigo: p.codigo,
            precioref: p.precioref,
            dosis_200lt: p.dosis_200lt,
            comentarioDosis: p.comentarioDosis,
            unidad: p.unidad,
            stockActual: disponible > 0 ? disponible : 0
        };
    }));
    res.json(productosConStock);
  } catch (error) {
    console.error("Error buscando productos:", error); // Log para ver errores en consola
    res.status(500).json({ error: "Error al buscar productos" });
  }
});

// ===============================
// GET /api/catalogos/productos/buscar
// ===============================
router.get("/productos/buscar", async (req, res) => {
  try {
    const q = (req.query.q as string) || ""; 
    const productosRaw = await prisma.producto.findMany({
      where: { AND: [ { activo: true }, { OR: [ { nombre: { contains: q, mode: "insensitive" } }, { codigo: { contains: q, mode: "insensitive" } } ] } ] },
      include: { unidad: true },
      orderBy: { nombre: 'asc' },
      take: 50 
    });

    const productosConStock = await Promise.all(productosRaw.map(async (p) => {
        const ingresos = await prisma.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: p.id, documento: { tipo: "INGRESO", estado: "APROBADO" } } });
        const salidas = await prisma.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: p.id, documento: { tipo: "SALIDA", estado: "APROBADO" } } });
        const ajustes = await prisma.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: p.id, documento: { tipo: "AJUSTE", estado: "APROBADO" } } });
        const devIn = await prisma.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: p.id, documento: { tipo: "DEVOLUCION", estado: "APROBADO", proveedorid: null } } });
        const devOut = await prisma.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: p.id, documento: { tipo: "DEVOLUCION", estado: "APROBADO", NOT: { proveedorid: null } } } });

        const stockFisico = ((Number(ingresos._sum.cantidad) || 0) + (Number(devIn._sum.cantidad) || 0) + (Number(ajustes._sum.cantidad) || 0)) - ((Number(salidas._sum.cantidad) || 0) + (Number(devOut._sum.cantidad) || 0));

        // 👇 CÓDIGO CORREGIDO TAMBIÉN AQUÍ
        const comprometido = await prisma.solicitud_item.aggregate({
            _sum: { cantidad: true },
            where: { 
                productoid: p.id, 
                solicitud: { 
                    estado: { in: ["PENDIENTE", "APROBADA"] }
      
                    // tipo: "DESPACHO" 
                } 
            }
        });
        
        const cantComprometida = Number(comprometido._sum.cantidad) || 0;
        const disponible = stockFisico - cantComprometida;

        return { ...p, stockActual: disponible > 0 ? disponible : 0 };
    }));
    res.json(productosConStock);
  } catch (error) {
    res.status(500).json({ error: "Error al buscar productos" });
  }
});


// ===============================
// GET /api/catalogos/CULTIVOS
// ===============================


router.get("/cultivos", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const cultivos = await prisma.cultivo.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, variedad: true }
    });
    res.json(cultivos);
  } catch (error) {
    console.error("Error al obtener cultivos:", error);
    res.status(500).json({ error: "Error al obtener cultivos" });
  }
});





export default router;