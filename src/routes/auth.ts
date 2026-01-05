// src/routes/auth.ts
import { Router } from "express";
import prisma from "../prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = Router();

// ==========================================
// POST /api/auth/login
// Recibe: { email, password }
// Devuelve: { user, token }
// ==========================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Buscar usuario por email
    const usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // 2. Verificar si está activo
    if (!usuario.activo) {
      return res.status(403).json({ message: "Usuario inactivo" });
    }

    // 3. Verificar contraseña (usando bcrypt)
    // Comparamos lo que escribió el usuario con el hash de la BD
    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // 4. Generar Token JWT
    const secret = process.env.JWT_SECRET || "secreto_por_defecto";
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
      secret,
      { expiresIn: "8h" } // El token dura 8 horas
    );

    // 5. Responder (Omitimos devolver el password)
    res.json({
      token,
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
    });

  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});





export default router;