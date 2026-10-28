import { Router, Response } from "express";
import prisma from "../../core/prisma";
import { authenticateToken, AuthRequest } from "../../core/middlewares/auth";

const router = Router();

// 🛡️ HELPER: Validar permisos
const puedeGestionar = (user: any) => {
  const rolesPermitidos = ["ADMIN", "BODEGUERO", "VISOR"];
  return rolesPermitidos.includes(user?.rol);
};

// ==========================================
// 1. OBTENER FINCAS (Dashboard)
// ==========================================
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const fincas = await prisma.finca.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        lote: {
          select: { estado: true, areamanzanas: true, areametroslineales: true }
        }
      }
    });

    const data = fincas.map(f => {
      const activos = f.lote.filter(l => l.estado === 'ABIERTO');
      const inactivos = f.lote.filter(l => l.estado === 'CERRADO');

      const areaActiva = activos.reduce((acc, l) => acc + Number(l.areamanzanas || 0), 0);
      const metrosActivos = activos.reduce((acc, l) => acc + Number(l.areametroslineales || 0), 0);

      return {
        id: f.id,
        nombre: f.nombre,
        ubicacion: f.ubicacion,
        stats: {
          totalLotes: f.lote.length,
          activos: activos.length,
          inactivos: inactivos.length,
          areaActiva: areaActiva.toFixed(2),
          metrosActivos: metrosActivos.toFixed(0)
        }
      };
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error al cargar fincas" });
  }
});

// ==========================================
// 2. CREAR FINCA
// ==========================================
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!puedeGestionar(req.user)) return res.status(403).json({ message: "No tienes permiso." });

    const { nombre, ubicacion } = req.body;
    if (!nombre) return res.status(400).json({ message: "El nombre es obligatorio" });

    const nueva = await prisma.finca.create({
      data: { nombre, ubicacion: ubicacion || null }
    });
    res.json(nueva);
  } catch (error) {
    res.status(400).json({ message: "Error: Ya existe una finca con ese nombre." });
  }
});

// ==========================================
// 3. OBTENER LOTES (Excel)
// ==========================================
router.get("/:id/lotes", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const lotes = await prisma.lote.findMany({
      where: { fincaid: id },
      include: {
        // 👇 IMPORTANTE: Incluimos variedad aquí
        cultivo: { select: { id: true, nombre: true, variedad: true } }
      },
      orderBy: [
        { estado: 'asc' },
        { codigo: 'asc' }
      ]
    });
    res.json(lotes);
  } catch (error) {
    res.status(500).json({ message: "Error cargando lotes" });
  }
});

// ==========================================
// 4. CREAR LOTE (Con Regla ML)
// ==========================================
router.post("/:id/lotes", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!puedeGestionar(req.user)) return res.status(403).json({ message: "No tienes permiso." });

    const fincaid = req.params.id;
    const { codigo, cultivoid, areamanzanas, areametroslineales, areahectareas, estado } = req.body;

    if (!codigo || !cultivoid) {
        return res.status(400).json({ message: "Código y Cultivo son obligatorios" });
    }

    const nuevo = await prisma.lote.create({
      data: {
        fincaid,
        codigo,
        cultivoid,
        areametroslineales: areametroslineales ? Number(areametroslineales) : 0,
        areamanzanas: areamanzanas ? Number(areamanzanas) : 0,
        areahectareas: areahectareas ? Number(areahectareas) : 0,
        estado: estado || 'ABIERTO',
        fechasiembra: new Date()
      }
    });
    res.json(nuevo);
  } catch (error: any) {
    // Manejo de error de duplicado (Unique constraint)
    if (error.code === 'P2002') {
        return res.status(400).json({ message: "Ya existe un lote con ese código en esta finca." });
    }
    res.status(500).json({ message: "Error creando lote." });
  }
});

// ==========================================
// 5. EDICIÓN EN LÍNEA (PATCH)
// ==========================================
router.patch("/lotes/:loteId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!puedeGestionar(req.user)) return res.status(403).json({ message: "No tienes permiso." });

    const { loteId } = req.params;
    const data = req.body;
    const updateData: any = {};

    // Recálculo automático de áreas
    if (data.areametroslineales !== undefined) {
        const ml = Number(data.areametroslineales);
        updateData.areametroslineales = ml;
        updateData.areamanzanas = ml / 7000;
        updateData.areahectareas = ml / 10000;
    }

    if (data.estado !== undefined) updateData.estado = data.estado;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;

    if (data.fechasiembra !== undefined) {
        updateData.fechasiembra = data.fechasiembra ? new Date(data.fechasiembra) : null;
    }
    if (data.fechacierre !== undefined) {
        updateData.fechacierre = data.fechacierre ? new Date(data.fechacierre) : null;
    }

    const actualizado = await prisma.lote.update({
      where: { id: loteId },
      data: updateData
    });

    res.json(actualizado);
  } catch (error) {
    res.status(500).json({ message: "Error al guardar celda." });
  }
});

router.get("/fincas-lotes", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const usuarioId = req.user?.id;
    const usuarioRol = req.user?.rol;

    let loteWhere: any = {
        estado: "ABIERTO"
    };

    if (usuarioRol === "SOLICITANTE" && usuarioId) {
       loteWhere.encargados = {
         some: { usuarioid: usuarioId }
       };
    }

    const fincas = await prisma.finca.findMany({
      orderBy: { nombre: "asc" },
      include: {
        lote: {
          where: loteWhere,
          select: {
              id: true,
              codigo: true,
              cultivo: { select: { nombre: true } }
          }
        }
      }
    });

    const fincasVisibles = fincas
        .map(f => ({
            ...f,
            lote: f.lote || []
        }))
        .filter(f => f.lote.length > 0);

    res.json(fincasVisibles);

  } catch (error) {
    console.error("❌ Error en /fincas-lotes:", error);
    res.status(500).json({ error: "Error al obtener fincas y lotes" });
  }
});

export default router;