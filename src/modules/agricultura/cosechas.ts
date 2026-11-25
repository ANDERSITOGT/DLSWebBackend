import { NextFunction, Response, Router } from "express";
import prisma from "../../core/prisma";
import { authenticateToken, AuthRequest } from "../../core/middlewares/auth";
import {
  cosechasService,
  CrearCosechaInput,
} from "./cosechasService";
import { parsearFechaNegocioOpcional } from "../../core/tiempo";

const router = Router();

// Cosechas es un módulo aparte de Bodega: solo ADMIN y COSECHA.
const soloCosechas = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!["ADMIN", "COSECHA"].includes(req.user?.rol)) {
    return res.status(403).json({ message: "No tienes permiso para el módulo de cosechas." });
  }
  next();
};

function esNumeroValido(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

router.post("/", authenticateToken, soloCosechas, async (req: AuthRequest, res: Response) => {
  try {
    const {
      loteId,
      fecha,
      libras_campo,
      libras_rechazo,
      libras_vendidas,
      observaciones,
      empacadoraId,
      numero_boleta,
      boletas,
    } = req.body as Partial<CrearCosechaInput>;

    if (
      typeof loteId !== "string" ||
      !loteId ||
      !fecha ||
      !esNumeroValido(libras_campo)
    ) {
      return res.status(400).json({
        message: "Lote, fecha y libras_campo son obligatorios y válidos.",
      });
    }

    if (
      (libras_rechazo !== undefined &&
        libras_rechazo !== null &&
        !esNumeroValido(libras_rechazo)) ||
      (libras_vendidas !== undefined &&
        libras_vendidas !== null &&
        !esNumeroValido(libras_vendidas))
    ) {
      return res.status(400).json({
        message: "Las cantidades de libras deben ser números válidos.",
      });
    }

        // Fecha de calendario en hora Guatemala (mediodía GT): no retrocede de día.
    const fechaCosecha = parsearFechaNegocioOpcional(fecha as string | Date, false);
    if (!fechaCosecha) {
      return res.status(400).json({ message: "La fecha no es válida." });
    }

    if (boletas !== undefined && !Array.isArray(boletas)) {
      return res.status(400).json({ message: "Boletas debe ser un arreglo." });
    }

    if (boletas?.some(
      (boleta) =>
        !boleta ||
        typeof boleta.empacadoraId !== "string" ||
        !boleta.empacadoraId ||
        !esNumeroValido(boleta.libras),
    )) {
      return res.status(400).json({
        message: "Cada boleta debe incluir una empacadora y libras válidas.",
      });
    }

    const data: CrearCosechaInput = {
      loteId,
      fecha: fechaCosecha,
      libras_campo,
      libras_rechazo,
      libras_vendidas,
      observaciones,
      empacadoraId,
      numero_boleta,
      boletas,
    };

    const cosecha = await cosechasService.crearCosecha(data, req.user!.id);
    return res.status(201).json({ ok: true, cosecha });
  } catch (error) {
    console.error("Error creando cosecha:", error);
    return res.status(500).json({ message: "Error al crear la cosecha." });
  }
});

router.get("/", authenticateToken, soloCosechas, async (_req: AuthRequest, res: Response) => {
  try {
    const data = await cosechasService.getListadoCosechas();
    return res.json({ ok: true, cosechas: data });
  } catch (error) {
    console.error("Error obteniendo cosechas:", error);
    return res.status(500).json({ message: "Error al cargar las cosechas." });
  }
});

router.get("/empacadoras", authenticateToken, soloCosechas, async (_req, res) => {
    try {
        const empacadoras = await prisma.empacadora.findMany({
            where: { activo: true },
            orderBy: { nombre: "asc" },
            select: { id: true, nombre: true }
        });
        res.json(empacadoras);
    } catch (error: any) {
        res.status(500).json({
            message: "Error al obtener empacadoras",
            error: error.message
        });
    }
});

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
