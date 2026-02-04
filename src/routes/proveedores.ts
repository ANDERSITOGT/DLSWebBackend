import { Router, Response } from "express";
import prisma from "../prisma";
import { authenticateToken, AuthRequest } from "../middlewares/auth";

const router = Router();

// 🔒 FUNCIÓN HELPER: Verificar Permisos
// Solo permitimos ADMIN y BODEGUERO.
// Si agregas más roles en el futuro, solo editas esta función.
const validarPermisos = (user: any) => {
  const rolesPermitidos = ["ADMIN", "BODEGUERO"];
  return rolesPermitidos.includes(user?.rol);
};

// ====================================================================
// 1. OBTENER LISTA
// ====================================================================
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // 1. Seguridad
    if (!validarPermisos(req.user)) {
      return res.status(403).json({ message: "No tienes permiso para ver proveedores." });
    }

    const proveedores = await prisma.proveedor.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        proveedor_contacto: true 
      }
    });
    res.json(proveedores);
  } catch (error) {
    console.error("Error al obtener proveedores:", error);
    res.status(500).json({ message: "Error interno al cargar proveedores" });
  }
});

// ====================================================================
// 2. CREAR PROVEEDOR
// ====================================================================
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // 1. Seguridad
    if (!validarPermisos(req.user)) {
      return res.status(403).json({ message: "No tienes permiso para crear proveedores." });
    }

    // 2. Sanitización (Trim)
    let { nombre, nit, notas } = req.body;
    nombre = nombre?.trim();
    nit = nit?.trim();
    notas = notas?.trim();

    // 3. Validaciones
    if (!nombre) return res.status(400).json({ message: "El nombre es obligatorio" });

    // Verificar duplicado (Case insensitive opcional, aquí exacto por ahora)
    const existe = await prisma.proveedor.findUnique({ where: { nombre } });
    if (existe) return res.status(400).json({ message: "Ya existe un proveedor con ese nombre" });

    const nuevo = await prisma.proveedor.create({
      data: { nombre, nit, notas }
    });

    res.status(201).json(nuevo);
  } catch (error) {
    console.error("Error al crear proveedor:", error);
    res.status(500).json({ message: "Error al crear el proveedor" });
  }
});

// ====================================================================
// 3. EDICIÓN EN LÍNEA (NIT y Notas)
// ====================================================================
router.patch("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // 1. Seguridad
    if (!validarPermisos(req.user)) {
      return res.status(403).json({ message: "No tienes permiso para editar proveedores." });
    }

    const { id } = req.params;
    let { nit, notas } = req.body;

    const updateData: any = {};
    if (nit !== undefined) updateData.nit = nit?.trim();
    if (notas !== undefined) updateData.notas = notas?.trim();

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No se enviaron datos para actualizar" });
    }

    const actualizado = await prisma.proveedor.update({
      where: { id },
      data: updateData
    });

    res.json(actualizado);
  } catch (error) {
    console.error("Error editando proveedor:", error);
    res.status(500).json({ message: "Error al actualizar la celda" });
  }
});

// ====================================================================
// 4. GESTIÓN DE CONTACTOS
// ====================================================================

// Agregar contacto
router.post("/:id/contactos", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // 1. Seguridad
    if (!validarPermisos(req.user)) {
      return res.status(403).json({ message: "No tienes permiso para agregar contactos." });
    }

    const { id } = req.params; 
    let { nombre, telefono, email, puesto, notas } = req.body;
    nombre = nombre?.trim();

    if (!nombre) return res.status(400).json({ message: "El nombre del contacto es obligatorio" });

    // 2. Verificar que el padre existe
    const proveedorExiste = await prisma.proveedor.findUnique({ where: { id } });
    if (!proveedorExiste) return res.status(404).json({ message: "El proveedor no existe." });

    const nuevoContacto = await prisma.proveedor_contacto.create({
      data: {
        proveedorid: id,
        nombre,
        telefono: telefono?.trim(),
        email: email?.trim(),
        puesto: puesto?.trim(),
        notas: notas?.trim()
      }
    });

    res.status(201).json(nuevoContacto);
  } catch (error) {
    console.error("Error creando contacto:", error);
    res.status(500).json({ message: "Error al guardar el contacto" });
  }
});

// Eliminar contacto
router.delete("/contactos/:contactoId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // 1. Seguridad
    if (!validarPermisos(req.user)) {
      return res.status(403).json({ message: "No tienes permiso para eliminar contactos." });
    }

    const { contactoId } = req.params;

    // Verificar existencia antes de borrar (opcional, pero buena práctica para dar 404)
    const existe = await prisma.proveedor_contacto.findUnique({ where: { id: contactoId } });
    if (!existe) return res.status(404).json({ message: "El contacto no existe" });

    await prisma.proveedor_contacto.delete({ where: { id: contactoId } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error eliminando contacto:", error);
    res.status(500).json({ message: "Error al eliminar contacto" });
  }
});

export default router;