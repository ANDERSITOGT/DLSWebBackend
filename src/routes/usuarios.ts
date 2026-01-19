import { Router, Response } from "express";
import prisma from "../prisma";
import bcrypt from "bcrypt"; 
import { authenticateToken, AuthRequest } from "../middlewares/auth";

const router = Router();

// ==========================================
// 🔐 RE-AUTENTICACIÓN (NUEVO)
// Verifica password sin generar token, solo para dar paso
// ==========================================
router.post("/verificar-acceso", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { password } = req.body;
        const userId = req.user?.id;

        if (!userId || !password) return res.status(400).json({ message: "Datos incompletos" });

        // Buscar al usuario actual en la DB para leer su hash real
        const usuario = await prisma.usuario.findUnique({ where: { id: userId } });

        if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });

        // Comparar contraseñas
        const match = await bcrypt.compare(password, usuario.password);

        if (!match) {
            return res.status(401).json({ message: "Contraseña incorrecta" });
        }

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error de servidor" });
    }
});

// ==========================================
// GET /api/usuarios
// LISTAR (SOLO ADMIN)
// ==========================================
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.rol !== "ADMIN") return res.status(403).json({ message: "Acceso denegado." });

    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true, // 👈 Importante traer este dato
        createdat: true, 
      },
      orderBy: { createdat: "desc" }
    });

    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ message: "Error interno al obtener usuarios." });
  }
});

// ==========================================
// POST /api/usuarios
// CREAR (SOLO ADMIN)
// ==========================================
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.rol !== "ADMIN") return res.status(403).json({ message: "Acceso denegado." });

    const { nombre, email, password, rol } = req.body;

    if (!nombre || !email || !password || !rol) return res.status(400).json({ message: "Faltan datos." });

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) return res.status(400).json({ message: "El correo ya existe." });

    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        password: hashedPassword,
        rol: rol,
        activo: true // Por defecto activo
      },
    });

    const { password: _, ...usuarioSinPass } = nuevoUsuario;
    res.status(201).json({ ok: true, usuario: usuarioSinPass });

  } catch (error) {
    res.status(500).json({ message: "Error interno al crear usuario." });
  }
});

// ==========================================
// PATCH /toggle-status (ACTIVAR/DESACTIVAR)
// ==========================================
router.patch("/:id/toggle-status", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.rol !== "ADMIN") return res.status(403).json({ message: "Acceso denegado" });
        
        const { id } = req.params;

        // 1. Verificar a quién queremos modificar
        const targetUser = await prisma.usuario.findUnique({ where: { id } });
        if (!targetUser) return res.status(404).json({ message: "Usuario no encontrado" });

        // 2. PROTECCIÓN DE ADMINS: No se puede desactivar a otro Admin
        if (targetUser.rol === "ADMIN") {
            return res.status(403).json({ message: "No se puede desactivar ni modificar a un Administrador." });
        }

        // 3. Invertir estado
        const nuevoEstado = !targetUser.activo;

        await prisma.usuario.update({
            where: { id },
            data: { activo: nuevoEstado }
        });

        res.json({ ok: true, message: `Usuario ${nuevoEstado ? 'activado' : 'desactivado'}.` });
    } catch (error) {
        res.status(500).json({ message: "Error al cambiar estado." });
    }
});

// ==========================================
// PATCH /reset-password
// ==========================================
router.patch("/:id/reset-password", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.rol !== "ADMIN") return res.status(403).json({ message: "Acceso denegado." });

        const { id } = req.params;
        const { newPassword } = req.body;

        // Verificar target
        const targetUser = await prisma.usuario.findUnique({ where: { id } });
        if (!targetUser) return res.status(404).json({ message: "Usuario no encontrado" });

        // PROTECCIÓN DE ADMINS
        if (targetUser.rol === "ADMIN" && targetUser.id !== req.user?.id) {
             return res.status(403).json({ message: "No puedes cambiar la contraseña de otro Administrador." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.usuario.update({ where: { id }, data: { password: hashedPassword } });

        res.json({ ok: true, message: "Contraseña actualizada." });

    } catch (error) {
        res.status(500).json({ message: "Error al actualizar contraseña." });
    }
});

export default router;