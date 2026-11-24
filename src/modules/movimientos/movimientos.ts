import { Router, Response, Request, NextFunction } from "express";
import multer from "multer";
import prisma from "../../core/prisma";
import { Prisma } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../../core/middlewares/auth";
import { requireRole } from "../../core/middlewares/roles";
import {
  movimientosService,
  MovimientoError,
  normalizarRangoFechas,
  LIMITE_PAGINA_DEFAULT,
  type MovimientosFiltros,
  type MovimientoTipo,
  type MovimientoEstado,
} from "./movimientosService";
import { extraerTexto, interpretarEscaneo } from "./ocrService";

const router = Router();

// ==========================================
// Configuración de subida para OCR
// ==========================================
const MIMES_IMAGEN = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES_OCR = 10 * 1024 * 1024; // 10 MB

const uploadOcr = multer({
  storage: multer.memoryStorage(), // nunca se escribe a disco
  limits: { fileSize: MAX_BYTES_OCR, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!MIMES_IMAGEN.has(file.mimetype)) {
      const err = new Error("Formato no soportado.") as Error & { codigo?: string };
      err.codigo = "ARCHIVO_INVALIDO";
      return cb(err);
    }
    cb(null, true);
  },
});

/**
 * Envuelve `uploadOcr.single("archivo")` aceptando además el campo legacy
 * `documento`. Devuelve 400 ARCHIVO_REQUERIDO si no llega ningún archivo.
 */
function subirFactura(req: Request, res: Response, next: NextFunction) {
  const handler = uploadOcr.fields([
    { name: "archivo", maxCount: 1 },
    { name: "documento", maxCount: 1 },
  ]);

  handler(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: "El archivo supera el límite de 10 MB.",
            codigo: "ARCHIVO_INVALIDO",
          });
        }
        return res.status(400).json({
          message: `Error al recibir el archivo: ${err.message}`,
          codigo: "ARCHIVO_INVALIDO",
        });
      }
      if (err?.codigo === "ARCHIVO_INVALIDO") {
        return res.status(400).json({
          message: "Formato no soportado. Use JPEG, PNG o WEBP.",
          codigo: "ARCHIVO_INVALIDO",
        });
      }
      return res.status(400).json({
        message: "No se pudo procesar el archivo enviado.",
        codigo: "ARCHIVO_INVALIDO",
      });
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const archivo = files?.archivo?.[0] ?? files?.documento?.[0];

    if (!archivo) {
      return res.status(400).json({
        message: "El archivo de factura es obligatorio.",
        codigo: "ARCHIVO_REQUERIDO",
      });
    }

    // Segundo filtro de seguridad sobre el MIME real recibido
    if (!MIMES_IMAGEN.has(archivo.mimetype)) {
      return res.status(400).json({
        message: "Formato no soportado. Use JPEG, PNG o WEBP.",
        codigo: "ARCHIVO_INVALIDO",
      });
    }

    (req as AuthRequest & { archivoFactura?: Express.Multer.File }).archivoFactura = archivo;
    next();
  });
}

// ==========================================
// POST /api/movimientos/escanear  (OCR de factura)
// Contrato: API_BACKEND.md §4.1
// ==========================================
router.post(
  "/escanear",
  authenticateToken,
  requireRole("ADMIN", "BODEGUERO"),
  subirFactura,
  async (req: AuthRequest & { archivoFactura?: Express.Multer.File }, res: Response) => {
    try {
      const archivo = req.archivoFactura;
      if (!archivo) {
        return res.status(400).json({
          message: "El archivo de factura es obligatorio.",
          codigo: "ARCHIVO_REQUERIDO",
        });
      }

      const proveedorIdRaw = (req.body?.proveedorId ?? "").toString().trim();
      const proveedorId = proveedorIdRaw.length > 0 ? proveedorIdRaw : null;

      const { textoCrudo, confianza } = await extraerTexto(archivo.buffer);

      const resultado = await interpretarEscaneo(prisma, {
        textoCrudo,
        confianza,
        proveedorId,
      });

      if (resultado.tipo === "sin_texto") {
        return res.status(422).json({
          message: "No se pudo leer el documento.",
          codigo: "OCR_SIN_TEXTO",
          escaneo: { textoCrudo: resultado.textoCrudo, confianza: resultado.confianza },
        });
      }

      return res.status(200).json({ ok: true, escaneo: resultado.escaneo });
    } catch (error: any) {
      console.error("Error en POST /api/movimientos/escanear:", error);
      return res.status(500).json({ message: "Error interno al procesar el escaneo." });
    }
  }
);

// ==========================================
// Snapshot de `precioref` para salidas / ajustes
// ==========================================
/**
 * Convierte `producto.precioref` en el valor a guardar como snapshot historico
 * en `documento_item.precioref`.
 *
 * Estas operaciones (SALIDA, AJUSTE, DEVOLUCION a proveedor) no manejan costo
 * unitario propio, por lo que si el precio de referencia del producto no es
 * valido o es 0 se devuelve `undefined` y la columna queda en `null` (no se
 * escribe un 0 enganoso).
 */
function snapshotPrecioref(precioref: unknown): Prisma.Decimal | undefined {
  if (precioref === null || precioref === undefined) return undefined;
  const n = Number(precioref);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return new Prisma.Decimal(Math.round((n + Number.EPSILON) * 100) / 100);
}

// ==========================================
// POST /api/movimientos/ingreso
// Solo ADMIN y BODEGUERO (mismo criterio que /ajuste y /devolucion-proveedor)
// ==========================================
router.post("/ingreso", authenticateToken, requireRole("ADMIN", "BODEGUERO"), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ message: "Error de identidad." });

    const documento = await movimientosService.registrarIngreso(req.body, userId);

    return res.status(201).json({
      ok: true,
      documento,
      message: "Ingreso registrado correctamente",
    });
  } catch (error: any) {
    // Errores de negocio controlados (400 / 403 / 404 / 409)
    if (error instanceof MovimientoError) {
      return res.status(error.statusCode).json({
        message: error.message,
        ...(error.codigo ? { codigo: error.codigo } : {}),
      });
    }

    // Violación de unicidad/lógica detectada por Prisma
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return res.status(409).json({
          message: "Esta factura ya fue registrada para este proveedor",
          codigo: "FACTURA_DUPLICADA",
        });
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          message: "Referencia inválida: la bodega, el producto, el lote o el proveedor no existen.",
          codigo: "REFERENCIA_INVALIDA",
        });
      }
    }

    console.error("Error al crear ingreso:", error);
    return res.status(500).json({ message: "Error interno al registrar el ingreso." });
  }
});

// ==========================================
// POST /api/movimientos/ajuste
// ==========================================
router.post("/ajuste", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { productoId, cantidad, notas, tipo } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autorizado" });
    if (!productoId || !cantidad || !notas) return res.status(400).json({ message: "Faltan datos" });
    const userRole = req.user?.rol;
    if (userRole !== "ADMIN" && userRole !== "BODEGUERO") return res.status(403).json({ message: "No tienes permisos para realizar ajustes." });

    const resultado = await prisma.$transaction(async (tx) => {
        const anioActual = new Date().getFullYear();
        let nuevoCorrelativo = 1;
        const contador = await tx.consecutivo.findUnique({ where: { tipo_anio: { tipo: "AJUSTE", anio: anioActual } } });
        if (contador) {
             const actualizado = await tx.consecutivo.update({ where: { id: contador.id }, data: { ultimo: { increment: 1 } } });
             nuevoCorrelativo = actualizado.ultimo || 1;
        } else {
             await tx.consecutivo.create({ data: { tipo: "AJUSTE", anio: anioActual, ultimo: 1, prefijo: "AJU" } });
             nuevoCorrelativo = 1;
        }
        const codigoGenerado = `AJU-${anioActual}-${nuevoCorrelativo.toString().padStart(4, '0')}`;
        const bodegaDefault = await tx.bodega.findFirst();
        const documento = await tx.documento.create({ data: { tipo: "AJUSTE", estado: "APROBADO", consecutivo: codigoGenerado, fecha: new Date(), creadorid: userId, bodegaorigenid: bodegaDefault?.id, observacion: notas } });
        const prod = await tx.producto.findUnique({ where: { id: productoId } });
        if (!prod) throw new Error("Producto no encontrado");
        // Snapshot historico: los ajustes no traen `costounit`, asi que se guarda
        // el `precioref` vigente del producto (si es > 0) en la linea.
        await tx.documento_item.create({ data: { documentoid: documento.id, productoid: productoId, unidadid: prod.unidadid, cantidad: Number(cantidad), precioref: snapshotPrecioref(prod.precioref), notas: `Ajuste manual (${tipo})` } });
        return documento;
    });
    res.json({ ok: true, documento: resultado });
  } catch (error: any) {
    console.error("Error al crear ajuste:", error);
    res.status(500).json({ message: "Error al guardar ajuste", error: error.message });
  }
});

// ==========================================
// POST /api/movimientos/devolucion-proveedor
// ==========================================
router.post("/devolucion-proveedor", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { proveedorId, bodegaId, items, notas } = req.body;
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "No autorizado" });
      if (!proveedorId || !items || items.length === 0) return res.status(400).json({ message: "Faltan datos" });
      const userRole = req.user?.rol;
      if (userRole !== "ADMIN" && userRole !== "BODEGUERO") return res.status(403).json({ message: "No tienes permisos para devolver a proveedores." });
  
      const resultado = await prisma.$transaction(async (tx) => {
          const anioActual = new Date().getFullYear();
          let nuevoCorrelativo = 1;
          const contador = await tx.consecutivo.findUnique({ where: { tipo_anio: { tipo: "DEVOLUCION", anio: anioActual } } });
          if (contador) {
               const actualizado = await tx.consecutivo.update({ where: { id: contador.id }, data: { ultimo: { increment: 1 } } });
               nuevoCorrelativo = actualizado.ultimo || 1;
          } else {
               await tx.consecutivo.create({ data: { tipo: "DEVOLUCION", anio: anioActual, ultimo: 1, prefijo: "DEV" } });
               nuevoCorrelativo = 1;
          }
          const codigoGenerado = `DEV-${anioActual}-${nuevoCorrelativo.toString().padStart(4, '0')}`;
          const documento = await tx.documento.create({ data: { tipo: "DEVOLUCION", estado: "APROBADO", consecutivo: codigoGenerado, fecha: new Date(), creadorid: userId, bodegaorigenid: bodegaId, proveedorid: proveedorId, observacion: notas || "Devolución a proveedor" } });
          for (const item of items) {
              const prod = await tx.producto.findUnique({ where: { id: item.productoId } });
              if (!prod) throw new Error("Producto no encontrado");
              await tx.documento_item.create({ data: { documentoid: documento.id, productoid: item.productoId, unidadid: prod.unidadid, cantidad: Number(item.cantidad), precioref: snapshotPrecioref(prod.precioref), notas: item.notas } });
          }
          return documento;
      });
      res.json({ ok: true, documento: resultado });
    } catch (error: any) {
      console.error("Error al devolver a proveedor:", error);
      res.status(500).json({ message: "Error al procesar devolución", error: error.message });
    }
  });


// ================================
// RUTAS DE LECTURA
// ================================

/**
 * Extrae y valida los filtros del listado desde el query string.
 * Los errores de `normalizarRangoFechas` (fechas inválidas o rango
 * excedido) se propagan como `MovimientoError` (400).
 */
function filtrosDesdeQuery(req: Request): MovimientosFiltros {
  const q = req.query;
  const { fechaInicio, fechaFin } = normalizarRangoFechas(q.fechaInicio, q.fechaFin);

  const tipo = texto(req.query.tipo);
  const estado = texto(req.query.estado);

  return {
    tipo: tipo ? (tipo.toUpperCase() as MovimientoTipo) : undefined,
    estado: estado ? (estado.toUpperCase() as MovimientoEstado) : undefined,
    proveedorId: texto(q.proveedorId),
    solicitanteId: texto(q.solicitanteId),
    bodegaId: texto(q.bodegaId),
    q: texto(q.q),
    fechaInicio,
    fechaFin,
  };
}

function texto(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const limpio = String(value).trim();
  return limpio.length > 0 ? limpio : undefined;
}

/** Traduce un `MovimientoError` a respuesta HTTP; devuelve `false` si no lo es. */
function responderError(res: Response, error: any, contexto: string): boolean {
  if (error instanceof MovimientoError) {
    res.status(error.statusCode).json({
      message: error.message,
      ...(error.codigo ? { codigo: error.codigo } : {}),
    });
    return true;
  }
  console.error(`Error en ${contexto}:`, error);
  return false;
}

// 1. EXPORTAR MOVIMIENTOS  (debe ir ANTES de "/:id")
router.get("/export", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const usuario = req.user ? { id: req.user.id, rol: req.user.rol } : undefined;
    const filtros = filtrosDesdeQuery(req);

    const { filename, mime, content } =
      await movimientosService.exportListadoMovimientosPDF(filtros, usuario);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error: any) {
    if (responderError(res, error, "GET /api/movimientos/export")) return;
    res.status(500).send("Error al exportar");
  }
});

// 2. MOVIMIENTOS GENERALES
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const usuario = req.user ? { id: req.user.id, rol: req.user.rol } : undefined;
    const filtros = filtrosDesdeQuery(req);

    const page = Number(req.query.page);
    const limit = Number(req.query.limit);

    const data = await movimientosService.getListadoMovimientos(
      filtros,
      {
        page: Number.isFinite(page) ? page : 1,
        limit: Number.isFinite(limit) ? limit : LIMITE_PAGINA_DEFAULT,
      },
      usuario
    );

    res.json(data);
  } catch (error: any) {
    if (responderError(res, error, "GET /api/movimientos")) return;
    res.status(500).json({ message: "Error al obtener movimientos" });
  }
});

// 3. DETALLE DE MOVIMIENTO
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const usuario = req.user ? { id: req.user.id, rol: req.user.rol } : undefined;
    const data = await movimientosService.getDetalleMovimiento(id, usuario);
    res.json(data);
  } catch (error: any) {
    if (responderError(res, error, "GET /api/movimientos/:id")) return;
    res.status(500).json({ message: "Error al obtener detalle" });
  }
});

// 4. EXPORTAR DETALLE MOVIMIENTO
router.get("/:id/export", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const usuario = req.user ? { id: req.user.id, rol: req.user.rol } : undefined;
    const { filename, mime, content } =
      await movimientosService.exportMovimientoDetallePDF(id, usuario);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error: any) {
    if (responderError(res, error, "GET /api/movimientos/:id/export")) return;
    res.status(500).send("Error al exportar detalle");
  }
});

export default router;