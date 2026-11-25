import { Router, Response } from "express";
import prisma from "../../core/prisma";
import { authenticateToken, AuthRequest } from "../../core/middlewares/auth";
import solicitudesService, {
  SolicitudError,
  ESTADOS_SOLICITUD,
  TIPOS_SOLICITUD,
  LIMITE_PAGINA_DEFAULT,
  LIMITE_PAGINA_MAX,
  type EstadoSolicitud,
  type TipoSolicitud,
} from "./solicitudesService";

const router = Router();

// ===============================
// HELPERS DE LA CAPA HTTP
// ===============================
/** Roles con permiso para aprobar / rechazar solicitudes. */
const ROLES_APROBADORES = new Set<string>(["ADMIN", "BODEGUERO"]);
/** Roles con permiso para despachar fisicamente (entregar). */
const ROLES_ENTREGADORES = new Set<string>(["ADMIN", "BODEGUERO"]);

function esEstadoValido(valor: unknown): valor is EstadoSolicitud {
  return typeof valor === "string" && (ESTADOS_SOLICITUD as readonly string[]).includes(valor);
}

function esTipoValido(valor: unknown): valor is TipoSolicitud {
  return typeof valor === "string" && (TIPOS_SOLICITUD as readonly string[]).includes(valor);
}

/** Lee un entero de query string, con valor por defecto y tope maximo. */
function leerEntero(valor: unknown, porDefecto: number, maximo: number): number {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  if (!Number.isFinite(n) || n <= 0) return porDefecto;
  return Math.min(Math.trunc(n), maximo);
}

function leerString(valor: unknown): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (typeof v !== "string") return undefined;
  const limpio = v.trim();
  return limpio.length > 0 ? limpio : undefined;
}

/**
 * Traduce cualquier error a una respuesta HTTP consistente.
 * - SolicitudError -> su statusCode y codigo de negocio.
 * - Cualquier otro -> 500 generico sin filtrar detalles internos.
 */
function responderError(res: Response, error: unknown, contexto: string) {
  if (error instanceof SolicitudError) {
    return res.status(error.statusCode).json({
      message: error.message,
      ...(error.codigo ? { codigo: error.codigo } : {}),
    });
  }
  console.error(`Error en ${contexto}:`, error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

// ===============================
// GET /api/solicitudes
// Listar (paginado y filtrado)
// ===============================
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { estado, tipo, bodegaId, q, page, limit } = req.query;
    const usuario = req.user;

    if (estado !== undefined && !esEstadoValido(estado)) {
      return res.status(400).json({
        message: `Parametro 'estado' invalido. Valores permitidos: ${ESTADOS_SOLICITUD.join(", ")}.`,
        codigo: "ESTADO_INVALIDO",
      });
    }
    if (tipo !== undefined && !esTipoValido(tipo)) {
      return res.status(400).json({
        message: `Parametro 'tipo' invalido. Valores permitidos: ${TIPOS_SOLICITUD.join(", ")}.`,
        codigo: "TIPO_INVALIDO",
      });
    }

    const resultado = await solicitudesService.getSolicitudes({
      filtros: {
        estado: esEstadoValido(estado) ? estado : undefined,
        tipo: esTipoValido(tipo) ? tipo : undefined,
        bodegaId: leerString(bodegaId),
        q: leerString(q),
      },
      paginacion: {
        page: leerEntero(page, 1, Number.MAX_SAFE_INTEGER),
        limit: leerEntero(limit, LIMITE_PAGINA_DEFAULT, LIMITE_PAGINA_MAX),
      },
      usuario: usuario ? { id: usuario.id, rol: usuario.rol } : undefined,
    });

    res.json({ ok: true, solicitudes: resultado.data, meta: resultado.meta });
  } catch (error) {
    responderError(res, error, "GET /api/solicitudes");
  }
});

// ===============================
// GET /api/solicitudes/:id
// Detalle
// ===============================
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const rol = req.user?.rol ?? null;

    if (rol === "SOLICITANTE") {
      const solicitanteId = await solicitudesService.getSolicitanteId(id);
      if (!solicitanteId) {
        return res.status(404).json({
          message: `Solicitud ${id} no encontrada`,
          codigo: "SOLICITUD_NO_ENCONTRADA",
        });
      }
      if (solicitanteId !== req.user?.id) {
        return res.status(403).json({
          message: "No tienes permiso para ver esta solicitud.",
          codigo: "SIN_PERMISO",
        });
      }
    }

    // El rol se propaga para ocultar importes a quien no puede verlos.
    const data = await solicitudesService.getDetalleSolicitud(id, rol);
    res.json(data);
  } catch (error) {
    responderError(res, error, "GET /api/solicitudes/:id");
  }
});

// ===============================
// POST /api/solicitudes
// Crear (Universal: Soporta Despachos y Devoluciones)
// ===============================
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Usuario no autenticado", codigo: "NO_AUTENTICADO" });
    }

    // 1. DETECCION INTELIGENTE DE ITEMS
    // El frontend a veces manda 'productos' (Despachos) y a veces 'items' (Devoluciones).
    const itemsEntrantes = req.body?.productos || req.body?.items || [];

    if (!Array.isArray(itemsEntrantes) || itemsEntrantes.length === 0) {
      return res.status(400).json({
        message: "La solicitud no contiene productos/items.",
        codigo: "SIN_ITEMS",
      });
    }

    // Tipo y origen (aceptar camelCase y snake_case).
    const tipoEntrante = req.body?.tipo;
    if (tipoEntrante !== undefined && !esTipoValido(tipoEntrante)) {
      return res.status(400).json({
        message: `Tipo de solicitud invalido. Valores permitidos: ${TIPOS_SOLICITUD.join(", ")}.`,
        codigo: "TIPO_INVALIDO",
      });
    }
    const tipoFinal: TipoSolicitud = esTipoValido(tipoEntrante)
      ? tipoEntrante
      : TIPOS_SOLICITUD[0];

    const solicitudOrigenId =
      leerString(req.body?.solicitudOrigenId) || leerString(req.body?.solicitud_origen_id);

    // 2. NORMALIZACION DE DATOS
    const productosMapeados = await Promise.all(
      itemsEntrantes.map(async (item: any) => {
        // A. Normalizar IDs (soportar camelCase y lowercase)
        const rawProductoId = item?.productoid || item?.productoId;
        const rawUnidadId = item?.unidadid || item?.unidadId;
        const rawLoteId = item?.loteid || item?.loteId;

        if (!rawProductoId) {
          throw new SolicitudError(
            "Cada item debe incluir 'productoid' (o 'productoId').",
            400,
            "ITEM_INVALIDO"
          );
        }

        // B. Recuperar Unidad si falta (caso Devoluciones)
        let unidadIdFinal = rawUnidadId;
        if (!unidadIdFinal) {
          const prod = await prisma.producto.findUnique({
            where: { id: rawProductoId },
            select: { unidadid: true },
          });
          if (!prod) {
            throw new SolicitudError(
              `Producto ${rawProductoId} no encontrado.`,
              400,
              "PRODUCTO_NO_ENCONTRADO"
            );
          }
          unidadIdFinal = prod.unidadid;
        }

        // C. Normalizar Cantidad
        // Prioridad: cantidad del item > cantidad global > 0
        const cantidadFinal = item?.cantidad ? Number(item.cantidad) : Number(req.body?.cantidad);
        if (!Number.isFinite(cantidadFinal) || cantidadFinal <= 0) {
          throw new SolicitudError(
            `Cantidad invalida para el producto ${rawProductoId}.`,
            400,
            "CANTIDAD_INVALIDA"
          );
        }

        return {
          productoid: rawProductoId,
          unidadid: unidadIdFinal,
          cantidad: cantidadFinal,
          loteid: rawLoteId || null,
          notas: item?.notas || "",
        };
      })
    );

    // 3. LLAMAR AL SERVICIO
    const nuevaSolicitud = await solicitudesService.crearSolicitud(
      {
        fecha: req.body?.fecha,
        bodegaid: req.body?.bodegaid ?? req.body?.bodegaId ?? null,
        // Un ADMIN puede crear a nombre de otro; el resto siempre a su nombre.
        solicitanteid: req.body?.solicitanteId || req.body?.solicitanteid || user.id,
        tipo: tipoFinal,
        solicitudOrigenId,
        productos: productosMapeados,
      },
      { id: user.id, rol: user.rol }
    );

    res.status(201).json({ ok: true, solicitud: nuevaSolicitud });
  } catch (error) {
    responderError(res, error, "POST /api/solicitudes");
  }
});

// ===============================
// PATCH /api/solicitudes/:id/estado
// Aprobar / Rechazar (maquina de estados estricta)
// ===============================
router.patch("/:id/estado", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { estado, motivo } = req.body ?? {};
    const usuario = req.user;

    if (!usuario) {
      return res.status(401).json({ message: "Usuario no autenticado", codigo: "NO_AUTENTICADO" });
    }

    if (!esEstadoValido(estado)) {
      return res.status(400).json({
        message: `Estado invalido. Valores permitidos: ${ESTADOS_SOLICITUD.join(", ")}.`,
        codigo: "ESTADO_INVALIDO",
      });
    }

    if (!ROLES_APROBADORES.has(usuario.rol ?? "")) {
      return res.status(403).json({
        message: "Solo ADMIN o BODEGUERO pueden aprobar o rechazar solicitudes.",
        codigo: "SIN_PERMISO",
      });
    }

    const data = await solicitudesService.actualizarEstadoSolicitud(
      id,
      estado,
      usuario.id,
      typeof motivo === "string" ? motivo : null,
      usuario.rol
    );

    res.json(data);
  } catch (error) {
    responderError(res, error, "PATCH /api/solicitudes/:id/estado");
  }
});

// ===============================
// GET /api/solicitudes/:id/export
// PDF
// ===============================
router.get("/:id/export", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;

    // Mismo aislamiento que el detalle: el SOLICITANTE solo exporta lo suyo.
    if (req.user?.rol === "SOLICITANTE") {
      const solicitanteId = await solicitudesService.getSolicitanteId(id);
      if (!solicitanteId) {
        return res.status(404).json({
          message: `Solicitud ${id} no encontrada`,
          codigo: "SOLICITUD_NO_ENCONTRADA",
        });
      }
      if (solicitanteId !== req.user.id) {
        return res.status(403).json({
          message: "No tienes permiso para ver esta solicitud.",
          codigo: "SIN_PERMISO",
        });
      }
    }

    const { filename, mime, content } = await solicitudesService.exportSolicitudDetallePDF(id);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    responderError(res, error, "GET /api/solicitudes/:id/export");
  }
});

// ===============================
// POST /api/solicitudes/:id/entregar
// Generar Documento de Salida/Devolucion + marcar ENTREGADA
// ===============================
router.post("/:id/entregar", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const usuario = req.user;

    if (!usuario?.id) {
      return res.status(401).json({
        message: "No se pudo identificar al usuario que realiza la entrega.",
        codigo: "NO_AUTENTICADO",
      });
    }

    if (!ROLES_ENTREGADORES.has(usuario.rol ?? "")) {
      return res.status(403).json({
        message: "Solo ADMIN o BODEGUERO pueden entregar solicitudes.",
        codigo: "SIN_PERMISO",
      });
    }

    const resultado = await solicitudesService.entregarSolicitud(id, usuario.id, usuario.rol);
    res.json(resultado);
  } catch (error) {
    responderError(res, error, "POST /api/solicitudes/:id/entregar");
  }
});

export default router;
