import { Router, Response } from "express";
import prisma from "../../core/prisma";
import { authenticateToken, AuthRequest } from "../../core/middlewares/auth";
import productosService from "./productosService";

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
      precioref
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
      precioref: precioref ? Number(precioref) : undefined
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
      activo
    } = req.body;

    const productoActualizado = await productosService.updateProducto(id, {
      nombre,
      codigo,
      categoriaid,
      unidadid,
      ingredienteactivo,
      precioref: precioref !== undefined ? Number(precioref) : undefined,
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
    console.error("Error buscando productos:", error);
    res.status(500).json({ error: "Error al buscar productos" });
  }
});

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
        const disponible = stockFisico - cantComprometida;

        return { ...p, stockActual: disponible > 0 ? disponible : 0 };
    }));
    res.json(productosConStock);
  } catch (error) {
    res.status(500).json({ error: "Error al buscar productos" });
  }
});

export default router;