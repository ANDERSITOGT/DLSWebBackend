import { Router, Response } from "express";
import prisma from "../prisma"; // Ajusta la ruta a tu instancia de prisma
import { authenticateToken, AuthRequest } from "../middlewares/auth"; // Ajusta rutas si es necesario

const router = Router();

// ====================================================================
// 1. OBTENER LISTA (Para la tabla tipo Excel)
// ====================================================================
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const proveedores = await prisma.proveedor.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        // Incluimos los contactos para mostrar el contador o el detalle rápido
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
// 2. CREAR PROVEEDOR (El botón nuevo que pediste)
// ====================================================================
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, nit, notas } = req.body;

    // Validación básica
    if (!nombre) return res.status(400).json({ message: "El nombre es obligatorio" });

    // Verificar duplicado
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
// 3. EDICIÓN EN LÍNEA (Tipo Excel)
// Solo permitimos editar NIT y NOTAS (Nombre no, como pediste)
// ====================================================================
router.patch("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { nit, notas } = req.body;

    // Solo actualizamos los campos permitidos si vienen en el body
    const updateData: any = {};
    if (nit !== undefined) updateData.nit = nit;
    if (notas !== undefined) updateData.notas = notas;

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
// 4. GESTIÓN DE CONTACTOS (Sub-recurso)
// ====================================================================

// Agregar contacto a un proveedor
router.post("/:id/contactos", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // ID del proveedor
    const { nombre, telefono, email, puesto, notas } = req.body;

    if (!nombre) return res.status(400).json({ message: "El nombre del contacto es obligatorio" });

    const nuevoContacto = await prisma.proveedor_contacto.create({
      data: {
        proveedorid: id,
        nombre,
        telefono,
        email,
        puesto,
        notas
      }
    });

    res.status(201).json(nuevoContacto);
  } catch (error) {
    console.error("Error creando contacto:", error);
    res.status(500).json({ message: "Error al guardar el contacto" });
  }
});

// Eliminar un contacto
router.delete("/contactos/:contactoId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { contactoId } = req.params;
    await prisma.proveedor_contacto.delete({ where: { id: contactoId } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error eliminando contacto:", error);
    res.status(500).json({ message: "Error al eliminar contacto" });
  }
});

export default router;