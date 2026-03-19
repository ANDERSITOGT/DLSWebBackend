import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middlewares/auth";
import { edicionCriticaService } from "../services/edicionCriticaService";
import prisma from "../prisma";
import bcrypt from "bcrypt";

const router = Router();

// Middleware de Seguridad: SOLO ADMIN
const requireAdmin = (req: AuthRequest, res: Response, next: Function) => {
  if (req.user?.rol !== "ADMIN") {
    return res.status(403).json({ message: "Acceso denegado. Se requiere nivel de administrador." });
  }
  next();
};

// ==========================================
// Búsqueda Avanzada (Data Grid Paginado)
// ==========================================
router.get("/documentos", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    
    const filtros = {
      documentoId: req.query.documentoId as string,
      tipo: req.query.tipo as string,
      productoId: req.query.productoId as string,
      fincaId: req.query.fincaId as string,
      loteId: req.query.loteId as string,
      fechaInicio: req.query.fechaInicio as string,
      fechaFin: req.query.fechaFin as string,
    };

    const resultado = await edicionCriticaService.buscarDocumentos(filtros, page, limit);
    res.json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al buscar documentos" });
  }
});

// ==========================================
// Verificación de Contraseña en Vivo
// ==========================================
router.post("/verificar-acceso", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    const usuarioId = req.user?.id;

    if (!usuarioId || !password) return res.status(400).json({ message: "Faltan datos" });

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });

    // Comparamos la contraseña enviada con el hash de la BD
    const match = await bcrypt.compare(password, usuario.password);
    
    if (match) {
      res.json({ ok: true });
    } else {
      res.status(401).json({ ok: false, message: "Contraseña incorrecta" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error de verificación" });
  }
});

// ==========================================
// Ejecutar Edición Crítica (Guardar Cambios)
// ==========================================
router.patch("/documentos/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const documentoId = req.params.id;
    const usuarioId = req.user!.id;
    const { justificacion, cambios } = req.body;

    if (!justificacion || justificacion.length < 10) {
      return res.status(400).json({ message: "Se requiere una justificación válida y detallada (mínimo 10 caracteres)." });
    }

    const resultado = await edicionCriticaService.ejecutarEdicionCritica(
      documentoId, 
      usuarioId, 
      justificacion, 
      cambios
    );

    res.json({ message: "Edición aplicada y auditada correctamente", documento: resultado });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message || "Error al aplicar la edición crítica" });
  }
});

export default router;