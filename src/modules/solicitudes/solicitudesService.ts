import prisma from "../../core/prisma";
import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";
import {
  ESTADO_DOCUMENTO_APROBADO,
  SOLICITUD_APROBADA,
  SOLICITUD_ENTREGADA,
  SOLICITUD_PENDIENTE,
  SOLICITUD_RECHAZADA,
  TIPO_DOCUMENTO_AJUSTE,
  TIPO_DOCUMENTO_DEVOLUCION,
  TIPO_DOCUMENTO_INGRESO,
  TIPO_DOCUMENTO_SALIDA,
  TIPO_SOLICITUD_DESPACHO,
  TIPO_SOLICITUD_DEVOLUCION,
} from "../../core/constants";
import {
  aNumero as aNumeroCompartido,
  calcularCpp,
  normalizarCosto as normalizarCostoCompartido,
  normalizarPrecioref as normalizarPreciorefCompartido,
  redondear as redondearCompartido,
  stockFisicoPorProducto,
} from "../../core/valuacion";
import { anioActualGT, formatearFechaHoraGT, parsearFechaNegocio, parsearFechaNegocioOpcional } from "../../core/tiempo";

// ===================================================
// ERRORES DE DOMINIO
// ===================================================
/**
 * Error de negocio del módulo de solicitudes.
 *
 * Permite que la capa HTTP traduzca reglas de negocio a status codes
 * (400 / 403 / 404 / 409) en lugar de devolver siempre 500.
 * Mismo patrón que `MovimientoError` en el módulo de movimientos.
 */
export class SolicitudError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public codigo?: string
  ) {
    super(message);
    this.name = "SolicitudError";
  }
}

// ===================================================
// TIPOS
// ===================================================
export type EstadoSolicitud =
  | typeof SOLICITUD_PENDIENTE
  | typeof SOLICITUD_APROBADA
  | typeof SOLICITUD_RECHAZADA
  | typeof SOLICITUD_ENTREGADA;

export type TipoSolicitud =
  | typeof TIPO_SOLICITUD_DESPACHO
  | typeof TIPO_SOLICITUD_DEVOLUCION;

type CrearSolicitudProductoDTO = {
  productoid: string;
  unidadid: string;
  cantidad: number;
  loteid?: string | null;
  notas?: string;
};

export type CrearSolicitudDTO = {
  fecha?: string;
  solicitanteid?: string; // Opcional porque lo puede inferir del usuario
  bodegaid?: string | null;
  productos: CrearSolicitudProductoDTO[];
  tipo?: TipoSolicitud;
  solicitudOrigenId?: string;
};

/** Usuario autenticado mínimo para aplicar reglas de rol y auditoría. */
export type UsuarioContexto = { id: string; rol?: string | null };

export type SolicitudesFiltros = {
  estado?: EstadoSolicitud;
  tipo?: TipoSolicitud;
  bodegaId?: string;
  q?: string;
};

export type SolicitudesPaginacion = { page: number; limit: number };

export type SolicitudResumenDTO = {
  id: string;
  codigo: string;
  /** ISO 8601 en UTC (consistente con el resto de la API). */
  fecha: string | null;
  estado: EstadoSolicitud;
  tipo: TipoSolicitud;
  bodegaNombre: string;
  solicitanteNombre: string;
  totalProductos: number;
  yaDevuelta: boolean;
};

export type SolicitudesPaginaDTO = {
  data: SolicitudResumenDTO[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export type SolicitudProductoDTO = {
  itemId: string;
  productoId: string;
  productoObjId: string | undefined;
  nombre: string;
  codigo: string;
  cantidad: number;
  unidad: string;
  unidadNombre: string;
  loteId: string | null;
  loteCodigo: string;
  cultivo: string;
  notas: string | null;
  /** `null` si el rol no puede ver importes o la línea no tiene costo. */
  costounit: number | null;
  /** `cantidad * costounit`. `null` en las mismas condiciones que `costounit`. */
  subtotal: number | null;
};

export type SolicitudHistorialDTO = {
  accion: string;
  fecha: string | null;
  usuario: { id: string; nombre: string } | null;
  payload: Prisma.JsonValue | null;
};

export type SolicitudDetalleDTO = {
  id: string;
  codigo: string;
  /** ISO 8601 en UTC (consistente con el resto de la API). */
  fecha: string | null;
  estado: EstadoSolicitud;
  tipo: TipoSolicitud;
  solicitante: { id: string; nombre: string };
  aprobador: { id: string; nombre: string } | null;
  bodega: { id: string; nombre: string } | null;
  productos: SolicitudProductoDTO[];
  documentoSalidaId: string | null;
  documentoSalidaConsecutivo: string | null;
  /** `null` si el rol no puede ver importes. */
  montoTotal: number | null;
  historial: SolicitudHistorialDTO[];
};

export type EntregarSolicitudResultadoDTO = {
  solicitud: {
    id: string;
    estado: EstadoSolicitud;
    aprobadorid: string | null;
    documentosalidaid: string | null;
  };
  documentoId: string;
  codigoDoc: string;
};

// ===================================================
// CONSTANTES DE DOMINIO
// ===================================================
export const ESTADOS_SOLICITUD: readonly EstadoSolicitud[] = [
  SOLICITUD_PENDIENTE,
  SOLICITUD_APROBADA,
  SOLICITUD_RECHAZADA,
  SOLICITUD_ENTREGADA,
];

export const TIPOS_SOLICITUD: readonly TipoSolicitud[] = [
  TIPO_SOLICITUD_DESPACHO,
  TIPO_SOLICITUD_DEVOLUCION,
];

export const LIMITE_PAGINA_DEFAULT = 15;
export const LIMITE_PAGINA_MAX = 100;

/**
 * Máquina de estados estricta.
 *
 *  PENDIENTE  -> APROBADA | RECHAZADA
 *  APROBADA   -> RECHAZADA          (ENTREGADA solo vía POST /:id/entregar)
 *  RECHAZADA  -> (terminal)
 *  ENTREGADA  -> (terminal)
 */
export const TRANSICIONES_PERMITIDAS: Record<
  EstadoSolicitud,
  readonly EstadoSolicitud[]
> = {
  [SOLICITUD_PENDIENTE]: [SOLICITUD_APROBADA, SOLICITUD_RECHAZADA],
  [SOLICITUD_APROBADA]: [SOLICITUD_RECHAZADA],
  [SOLICITUD_RECHAZADA]: [],
  [SOLICITUD_ENTREGADA]: [],
};

export const ACCION_AUDITORIA = {
  CREAR: "CREAR",
  APROBAR: "APROBAR",
  RECHAZAR: "RECHAZAR",
  ENTREGAR: "ENTREGAR",
} as const;

const ENTIDAD_AUDITORIA = "SOLICITUD";

/** Roles autorizados a ver importes (`montoTotal`, `costounit`, `subtotal`). */
const ROLES_CON_COSTOS = new Set<string>(["ADMIN", "BODEGUERO"]);

/** Indica si el rol puede ver importes monetarios. */
export function puedeVerCostos(rol?: string | null): boolean {
  return !!rol && ROLES_CON_COSTOS.has(rol);
}

/** `producto.precioref` es `Decimal(12, 2)`. */
export const PRECIOREF_DECIMALES = 2;
export const PRECIOREF_MAX_ENTERO = 10 ** (12 - PRECIOREF_DECIMALES);

/** `documento_item.costounit` es `Decimal(12, 4)`. */
export const COSTOUNIT_DECIMALES = 4;
export const COSTOUNIT_MAX_ENTERO = 10 ** (12 - COSTOUNIT_DECIMALES);

// ===================================================
// HELPERS NUMÉRICOS
// ===================================================
//
// Todos delegan en `src/core/valuacion.ts` para tener una única fuente de
// verdad de redondeo/precisión en todo el sistema.
//
/** Redondea a `dec` decimales evitando artefactos de punto flotante. */
const redondear = redondearCompartido;

/** Convierte a número (acepta coma decimal y `Prisma.Decimal`). */
export const aNumero = aNumeroCompartido;

/** Recorta un string de query/body; devuelve `null` si queda vacío. */
export function textoOpcional(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const limpio = String(value).trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * Normaliza un importe a la precisión de `documento_item.costounit`
 * (`Decimal(12, 4)`). Devuelve `null` si no es un número finito positivo.
 */
export function normalizarCosto(value: unknown): number | null {
  return normalizarCostoCompartido(value);
}

/**
 * Normaliza un importe a la precisión de `documento_item.precioref`
 * (`Decimal(12, 2)`). Devuelve `null` si no es un número finito positivo.
 */
export function normalizarPrecioref(value: unknown): number | null {
  return normalizarPreciorefCompartido(value);
}

/**
 * Serializa el payload de auditoría a `Prisma.InputJsonValue`.
 *
 * `JSON.stringify` descarta las claves con valor `undefined`, por lo que el
 * resultado siempre es un objeto JSON plano válido para Prisma.
 */
function jsonSeguro(objeto: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(objeto)) as Prisma.InputJsonValue;
}

// ===================================================
// AUDITORÍA
// ===================================================
async function registrarAuditoria(
  tx: Prisma.TransactionClient,
  input: {
    solicitudId: string;
    usuarioId: string;
    accion: string;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  await tx.auditoria.create({
    data: {
      usuarioid: input.usuarioId,
      entidad: ENTIDAD_AUDITORIA,
      entidadid: input.solicitudId,
      accion: input.accion,
      payload: jsonSeguro(input.payload),
      ip: "Sistema Web",
    },
  });
}

// ===================================================
// COSTEO: RESOLUCIÓN DE COSTO UNITARIO
// ===================================================
type CostoResuelto = {
  costounit: number | null;
  origen: "PRECIOREF" | "ULTIMO_INGRESO" | "SIN_COSTO";
};

/**
 * Resuelve el costo unitario con el que debe congelarse una línea de SALIDA
 * generada desde un DESPACHO.
 *
 * Orden de resolución:
 *  1. `producto.precioref` vigente (si es > 0).
 *  2. Fallback: `costounit` de la última línea (`createdat desc`) de un
 *     documento `INGRESO` en estado `APROBADO` para ese producto, cuyo costo
 *     sea > 0. Se ignoran las líneas sin costo (0 / null) para no arrastrar
 *     un cero engañoso.
 *
 * Devuelve `costounit: null` si no hay ningún costo válido en la historia del
 * producto: en ese caso la línea queda sin costo (igual que una SALIDA manual).
 */
export async function resolverCostoDespacho(
  tx: Prisma.TransactionClient,
  productoid: string
): Promise<CostoResuelto> {
  const producto = await tx.producto.findUnique({
    where: { id: productoid },
    select: { precioref: true },
  });

  const desdePrecio = normalizarCosto(producto?.precioref);
  if (desdePrecio !== null) {
    return { costounit: desdePrecio, origen: "PRECIOREF" };
  }

  // Fallback: último costo real de compra registrado en un INGRESO aprobado.
  const ultimoIngreso = await tx.documento_item.findFirst({
    where: {
      productoid,
      costounit: { gt: 0 },
      documento: {
        tipo: TIPO_DOCUMENTO_INGRESO,
        estado: ESTADO_DOCUMENTO_APROBADO,
      },
    },
    orderBy: [{ createdat: "desc" }, { id: "desc" }],
    select: { costounit: true },
  });

  const desdeIngreso = normalizarCosto(ultimoIngreso?.costounit);
  if (desdeIngreso !== null) {
    return { costounit: desdeIngreso, origen: "ULTIMO_INGRESO" };
  }

  return { costounit: null, origen: "SIN_COSTO" };
}

type CostosOrigenDevolucion = {
  /** Costo heredado del documento de salida original, por producto. */
  porProducto: Map<string, number>;
  /** Documento de salida del que se heredaron los costos. */
  documentoSalidaId: string | null;
};

/**
 * Obtiene los costos con los que salieron los productos en el documento de
 * salida original de una solicitud origen (para una DEVOLUCIÓN).
 *
 * Cadena: `solicitud_origen_id` -> `solicitud.documentosalidaid` -> `documento_item`.
 * Si un producto aparece varias veces en el origen, se toma el costo de la
 * última línea válida.
 */
export async function cargarCostosOrigenDevolucion(
  tx: Prisma.TransactionClient,
  solicitudOrigenId: string
): Promise<CostosOrigenDevolucion> {
  const porProducto = new Map<string, number>();

  const origen = await tx.solicitud.findUnique({
    where: { id: solicitudOrigenId },
    select: { documentosalidaid: true },
  });

  const documentoSalidaId = origen?.documentosalidaid ?? null;
  if (!documentoSalidaId) {
    return { porProducto, documentoSalidaId: null };
  }

  const items = await tx.documento_item.findMany({
    where: { documentoid: documentoSalidaId },
    orderBy: [{ createdat: "asc" }, { id: "asc" }],
    select: { productoid: true, costounit: true },
  });

  for (const item of items) {
    const costo = normalizarCosto(item.costounit);
    if (costo !== null) porProducto.set(item.productoid, costo);
  }

  return { porProducto, documentoSalidaId };
}

// ===================================================
// LISTAR - Solicitudes (paginado y filtrado)
// ===================================================
export function normalizarPaginacion(
  paginacion?: Partial<SolicitudesPaginacion>
): SolicitudesPaginacion {
  const page = Math.max(1, Math.trunc(paginacion?.page ?? 1) || 1);
  const limitRaw =
    Math.trunc(paginacion?.limit ?? LIMITE_PAGINA_DEFAULT) || LIMITE_PAGINA_DEFAULT;
  const limit = Math.min(LIMITE_PAGINA_MAX, Math.max(1, limitRaw));
  return { page, limit };
}

/**
 * Listado paginado de solicitudes con filtros.
 *
 * - `q` busca case-insensitive por `solicitud.id` (código legible, p. ej.
 *   `SOL-2026-0001`) o por nombre/código de producto en `solicitud_item`.
 * - Aislamiento: un `SOLICITANTE` solo ve las suyas. El filtro por rol se
 *   aplica al final para que siempre gane sobre cualquier query string.
 */
async function getSolicitudes(opciones: {
  filtros?: SolicitudesFiltros;
  paginacion?: SolicitudesPaginacion;
  usuario?: UsuarioContexto;
}): Promise<SolicitudesPaginaDTO> {
  const filtros = opciones.filtros ?? {};
  const { page, limit } = normalizarPaginacion(opciones.paginacion);

  const where: Prisma.solicitudWhereInput = {};

  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.tipo) where.tipo = filtros.tipo;
  if (filtros.bodegaId) where.bodegaid = filtros.bodegaId;

  const q = textoOpcional(filtros.q);
  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      {
        solicitud_item: {
          some: {
            OR: [
              { producto: { nombre: { contains: q, mode: "insensitive" } } },
              { producto: { codigo: { contains: q, mode: "insensitive" } } },
            ],
          },
        },
      },
    ];
  }

  // SEGURIDAD DE LECTURA: Solicitante solo ve lo suyo (al final, siempre gana)
  if (opciones.usuario?.rol === "SOLICITANTE") {
    where.solicitanteid = opciones.usuario.id;
  }

  const [total, solicitudes] = await Promise.all([
    prisma.solicitud.count({ where }),
    prisma.solicitud.findMany({
      where,
      orderBy: [{ fecha: "desc" }, { createdat: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        bodega: true,
        usuario_solicitud_solicitanteidTousuario: true,
        solicitud_item: true,
        other_solicitud: {
          where: {
            tipo: TIPO_SOLICITUD_DEVOLUCION,
            estado: { not: SOLICITUD_RECHAZADA },
          },
          select: { id: true },
        },
      },
    }),
  ]);

  const data: SolicitudResumenDTO[] = solicitudes.map((s) => ({
    id: s.id,
    codigo: s.id,
    fecha: s.fecha ? s.fecha.toISOString() : null,
    estado: (s.estado ?? SOLICITUD_PENDIENTE) as EstadoSolicitud,
    tipo: (s.tipo ?? TIPO_SOLICITUD_DESPACHO) as TipoSolicitud,
    bodegaNombre: s.bodega?.nombre ?? "Sin Bodega",
    solicitanteNombre: s.usuario_solicitud_solicitanteidTousuario?.nombre ?? "Desconocido",
    totalProductos: s.solicitud_item.length,
    yaDevuelta: !!s.other_solicitud && s.other_solicitud.length > 0,
  }));

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ===================================================
// DETALLE
// ===================================================
/**
 * Detalle completo de una solicitud.
 *
 * - `aprobador`: usuario que aprobó (columna `solicitud.aprobadorid`).
 * - `productos[].costounit / subtotal`: costos congelados en la línea del
 *   documento de salida (si existe). `null` para roles sin permiso de costos.
 * - `historial`: eventos de `auditoria` (entidad SOLICITUD) en orden ascendente.
 *
 * @param rolUsuario Rol del usuario que consulta (para ocultar importes). Si
 *   se omite (`undefined`), se asume un contexto con acceso a costos.
 */
async function getDetalleSolicitud(
  id: string,
  rolUsuario?: string | null
): Promise<SolicitudDetalleDTO> {
  const solicitud = await prisma.solicitud.findUnique({
    where: { id },
    include: {
      bodega: true,
      usuario_solicitud_solicitanteidTousuario: true,
      usuario_solicitud_aprobadoridTousuario: true,
      solicitud_item: {
        include: {
          producto: true,
          unidad: true,
          lote: { include: { cultivo: true } },
        },
      },
      documento: true,
    },
  });

  if (!solicitud) {
    throw new SolicitudError(
      `Solicitud ${id} no encontrada`,
      404,
      "SOLICITUD_NO_ENCONTRADA"
    );
  }

  const verCostos = rolUsuario === undefined ? true : puedeVerCostos(rolUsuario);

  // Costos congelados del documento de salida (si la solicitud fue entregada).
  const costosPorProducto = new Map<string, number>();
  if (solicitud.documentosalidaid) {
    const itemsSalida = await prisma.documento_item.findMany({
      where: { documentoid: solicitud.documentosalidaid },
      orderBy: [{ createdat: "asc" }, { id: "asc" }],
      select: { productoid: true, costounit: true },
    });
    for (const item of itemsSalida) {
      const costo = aNumero(item.costounit);
      if (costo !== null && costo > 0) costosPorProducto.set(item.productoid, costo);
    }
  }

  let montoTotal: number | null = null;
  let acumulado = 0;
  let hayCosto = false;

  const productos: SolicitudProductoDTO[] = solicitud.solicitud_item.map((d) => {
    const cantidad = Number(d.cantidad);
    const costoBruto = costosPorProducto.get(d.productoid);
    const costounit =
      verCostos && costoBruto !== undefined
        ? redondear(costoBruto, COSTOUNIT_DECIMALES)
        : null;
    const subtotal = costounit === null ? null : redondear(cantidad * costounit);

    if (subtotal !== null) {
      hayCosto = true;
      acumulado += subtotal;
    }

    return {
      itemId: d.id,
      productoId: d.productoid,
      productoObjId: d.producto?.id,
      nombre: d.producto?.nombre ?? "Producto eliminado",
      codigo: d.producto?.codigo ?? "---",
      cantidad,
      unidad: d.unidad?.abreviatura ?? "",
      unidadNombre: d.unidad?.nombre ?? "",
      loteId: d.loteid ?? null,
      loteCodigo: d.lote?.codigo ?? "Sin Lote",
      cultivo: d.lote?.cultivo?.nombre || "General",
      notas: d.notas ?? null,
      costounit,
      subtotal,
    };
  });

  if (verCostos && hayCosto) montoTotal = redondear(acumulado);

  const auditorias = await prisma.auditoria.findMany({
    where: { entidad: ENTIDAD_AUDITORIA, entidadid: solicitud.id },
    orderBy: [{ fecha: "asc" }, { id: "asc" }],
    include: { usuario: { select: { id: true, nombre: true } } },
  });

  const historial: SolicitudHistorialDTO[] = auditorias.map((a) => ({
    accion: a.accion,
    fecha: a.fecha ? a.fecha.toISOString() : null,
    usuario: a.usuario ? { id: a.usuario.id, nombre: a.usuario.nombre } : null,
    payload: a.payload ?? null,
  }));

  return {
    id: solicitud.id,
    codigo: solicitud.id,
    fecha: solicitud.fecha ? solicitud.fecha.toISOString() : null,
    estado: (solicitud.estado ?? SOLICITUD_PENDIENTE) as EstadoSolicitud,
    tipo: (solicitud.tipo ?? TIPO_SOLICITUD_DESPACHO) as TipoSolicitud,
    solicitante: {
      id: solicitud.solicitanteid,
      nombre: solicitud.usuario_solicitud_solicitanteidTousuario?.nombre ?? "",
    },
    aprobador: solicitud.usuario_solicitud_aprobadoridTousuario
      ? {
          id: solicitud.usuario_solicitud_aprobadoridTousuario.id,
          nombre: solicitud.usuario_solicitud_aprobadoridTousuario.nombre,
        }
      : null,
    bodega: solicitud.bodega
      ? { id: solicitud.bodegaid!, nombre: solicitud.bodega.nombre }
      : null,
    productos,
    documentoSalidaId: solicitud.documentosalidaid ?? null,
    documentoSalidaConsecutivo: solicitud.documento?.consecutivo ?? null,
    montoTotal,
    historial,
  };
}

/** Verifica que la solicitud exista; lanza `SolicitudError` 404 si no. */
async function existeSolicitud(id: string): Promise<boolean> {
  const encontrada = await prisma.solicitud.findUnique({
    where: { id },
    select: { id: true },
  });
  return !!encontrada;
}

/** Dueño de la solicitud (para aplicar el aislamiento de SOLICITANTE). */
async function getSolicitanteId(id: string): Promise<string | null> {
  const solicitud = await prisma.solicitud.findUnique({
    where: { id },
    select: { solicitanteid: true },
  });
  return solicitud?.solicitanteid ?? null;
}

// ===================================================
// CREAR SOLICITUD (CON SEGURIDAD Y STOCK)
// ===================================================
async function crearSolicitud(
  input: CrearSolicitudDTO,
  usuarioActual: UsuarioContexto
): Promise<SolicitudDetalleDTO> {
  const {
    fecha,
    solicitanteid,
    bodegaid,
    productos,
    tipo = TIPO_SOLICITUD_DESPACHO,
    solicitudOrigenId,
  } = input;

  // 1. Determinar quién es el solicitante real
  // Si soy ADMIN, puedo pedir a nombre de otro. Si soy SOLICITANTE, soy yo mismo.
  const finalSolicitanteId =
    usuarioActual.rol === "ADMIN" && solicitanteid ? solicitanteid : usuarioActual.id;

  if (!finalSolicitanteId) {
    throw new SolicitudError(
      "No se pudo identificar al solicitante.",
      400,
      "SOLICITANTE_REQUERIDO"
    );
  }

  // Transacción para asegurar integridad
  const nuevaSolicitud = await prisma.$transaction(async (tx) => {
    // A. Validar Devoluciones Duplicadas
    if (tipo === TIPO_SOLICITUD_DEVOLUCION && solicitudOrigenId) {
      const yaExiste = await tx.solicitud.findFirst({
        where: {
          solicitud_origen_id: solicitudOrigenId,
          estado: { not: SOLICITUD_RECHAZADA },
        },
      });
      if (yaExiste) {
        throw new SolicitudError(
          `La solicitud ${solicitudOrigenId} ya tiene una devolución activa.`,
          409,
          "DEVOLUCION_DUPLICADA"
        );
      }
    }

    // B. VALIDAR ITEMS (Seguridad Lote + Stock)
    for (const item of productos) {
      // SEGURIDAD: ¿Tiene permiso en este lote?
      if (item.loteid && usuarioActual.rol === "SOLICITANTE") {
        const permiso = await tx.lote_encargado.findFirst({
          where: { loteid: item.loteid, usuarioid: finalSolicitanteId },
        });
        if (!permiso) {
          const loteInfo = await tx.lote.findUnique({
            where: { id: item.loteid },
            select: { codigo: true },
          });
          throw new SolicitudError(
            `SEGURIDAD: No tienes permiso asignado para el lote ${
              loteInfo?.codigo || "seleccionado"
            }.`,
            400,
            "LOTE_NO_ASIGNADO"
          );
        }
      }

      // STOCK: Solo validar si es DESPACHO
      if (tipo === TIPO_SOLICITUD_DESPACHO) {
        // Calcular Stock Físico
        const ingresos = await tx.documento_item.aggregate({
          _sum: { cantidad: true },
          where: {
            productoid: item.productoid,
            documento: { tipo: TIPO_DOCUMENTO_INGRESO, estado: ESTADO_DOCUMENTO_APROBADO },
          },
        });
        const salidas = await tx.documento_item.aggregate({
          _sum: { cantidad: true },
          where: {
            productoid: item.productoid,
            documento: { tipo: TIPO_DOCUMENTO_SALIDA, estado: ESTADO_DOCUMENTO_APROBADO },
          },
        });
        const ajustes = await tx.documento_item.aggregate({
          _sum: { cantidad: true },
          where: {
            productoid: item.productoid,
            documento: { tipo: TIPO_DOCUMENTO_AJUSTE, estado: ESTADO_DOCUMENTO_APROBADO },
          },
        });
        const devIn = await tx.documento_item.aggregate({
          _sum: { cantidad: true },
          where: {
            productoid: item.productoid,
            documento: {
              tipo: TIPO_DOCUMENTO_DEVOLUCION,
              estado: ESTADO_DOCUMENTO_APROBADO,
              proveedorid: null,
            },
          },
        });
        const devOut = await tx.documento_item.aggregate({
          _sum: { cantidad: true },
          where: {
            productoid: item.productoid,
            documento: {
              tipo: TIPO_DOCUMENTO_DEVOLUCION,
              estado: ESTADO_DOCUMENTO_APROBADO,
              NOT: { proveedorid: null },
            },
          },
        });

        const stockFisico =
          (Number(ingresos._sum.cantidad) || 0) +
          (Number(devIn._sum.cantidad) || 0) +
          (Number(ajustes._sum.cantidad) || 0) -
          (Number(salidas._sum.cantidad) || 0) -
          (Number(devOut._sum.cantidad) || 0);

        // Calcular Stock Comprometido
        const comprometido = await tx.solicitud_item.aggregate({
          _sum: { cantidad: true },
          where: {
            productoid: item.productoid,
            solicitud: {
              estado: { in: [SOLICITUD_PENDIENTE, SOLICITUD_APROBADA] },
              tipo: TIPO_SOLICITUD_DESPACHO,
            },
          },
        });

        const stockComprometido = Number(comprometido._sum.cantidad) || 0;
        const disponible = stockFisico - stockComprometido;

        if (Number(item.cantidad) > disponible) {
          const prod = await tx.producto.findUnique({ where: { id: item.productoid } });
          throw new SolicitudError(
            `Stock insuficiente para "${prod?.nombre}". Disponible: ${disponible}, Solicitado: ${item.cantidad}`,
            400,
            "STOCK_INSUFICIENTE"
          );
        }
      }
    }

    // C. Generar Consecutivo (SOL-2026-XXXX)
    const anioActual = anioActualGT();
    let correlativo = 1;
    const contador = await tx.consecutivo.findUnique({
      where: { tipo_anio: { tipo: "SOLICITUD", anio: anioActual } },
    });

    if (contador) {
      const upd = await tx.consecutivo.update({
        where: { id: contador.id },
        data: { ultimo: { increment: 1 } },
      });
      correlativo = upd.ultimo || 1;
    } else {
      await tx.consecutivo.create({
        data: { tipo: "SOLICITUD", anio: anioActual, ultimo: 1, prefijo: "SOL" },
      });
    }
    const codigo = `SOL-${anioActual}-${String(correlativo).padStart(4, "0")}`;

    // D. Crear Solicitud
    const nueva = await tx.solicitud.create({
      data: {
        id: codigo,
        // Fecha en hora Guatemala: una fecha solo-día conserva la hora actual de
        // GT para no retroceder al día anterior.
        fecha: parsearFechaNegocio(fecha, true),
        estado: SOLICITUD_PENDIENTE,
        tipo,
        solicitanteid: finalSolicitanteId,
        bodegaid: bodegaid ?? null,
        solicitud_origen_id: solicitudOrigenId || null,
        solicitud_item: {
          create: productos.map((p) => ({
            productoid: p.productoid,
            unidadid: p.unidadid,
                        cantidad: p.cantidad,
            loteid: p.loteid ?? null,
            notas: p.notas,
          })),
        },
      },
    });

    // E. Auditoría: CREAR
    await registrarAuditoria(tx, {
      solicitudId: nueva.id,
      usuarioId: usuarioActual.id,
      accion: ACCION_AUDITORIA.CREAR,
      payload: {
        tipo,
        bodegaId: bodegaid ?? null,
        solicitanteId: finalSolicitanteId,
        solicitudOrigenId: solicitudOrigenId || null,
        items: productos.map((p) => ({
          productoId: p.productoid,
          unidadId: p.unidadid,
          cantidad: p.cantidad,
          loteId: p.loteid ?? null,
        })),
      },
    });

    return nueva;
  });

  return getDetalleSolicitud(nuevaSolicitud.id);
}

// ===================================================
// ACTUALIZAR ESTADO (máquina de estados estricta)
// ===================================================
/**
 * Cambia el estado de una solicitud validando la transición permitida.
 *
 *  PENDIENTE -> APROBADA | RECHAZADA
 *  APROBADA  -> RECHAZADA          (ENTREGADA solo vía `entregarSolicitud`)
 *  RECHAZADA / ENTREGADA -> terminales (400 TRANSICION_INVALIDA)
 *
 * Registra el evento en `auditoria` (APROBAR / RECHAZAR, con `motivo` si
 * viene). `aprobadorid` solo se escribe al APROBAR, de modo que queda
 * registrado quién aprobó y no se pisa después con quien entrega.
 *
 * @param motivo Texto libre (recomendado al rechazar).
 * @param rolUsuario Rol del usuario que ejecuta el cambio. Si es SOLICITANTE
 *   y la solicitud no es suya -> 403.
 */
async function actualizarEstadoSolicitud(
  id: string,
  nuevoEstado: EstadoSolicitud,
  aprobadorId: string,
  motivo?: string | null,
  rolUsuario?: string | null
): Promise<SolicitudDetalleDTO> {
  if (!ESTADOS_SOLICITUD.includes(nuevoEstado)) {
    throw new SolicitudError(
      `Estado '${nuevoEstado}' inválido. Valores permitidos: ${ESTADOS_SOLICITUD.join(", ")}.`,
      400,
      "ESTADO_INVALIDO"
    );
  }

  if (nuevoEstado === SOLICITUD_ENTREGADA) {
    // ENTREGADA solo se alcanza ejecutando la entrega (que mueve inventario).
    throw new SolicitudError(
      "Una solicitud no puede marcarse como ENTREGADA por esta vía; usa POST /api/solicitudes/:id/entregar.",
      400,
      "TRANSICION_INVALIDA"
    );
  }

  const actual = await prisma.solicitud.findUnique({
    where: { id },
    select: { id: true, estado: true, solicitanteid: true },
  });

  if (!actual) {
    throw new SolicitudError(
      `Solicitud ${id} no encontrada.`,
      404,
      "SOLICITUD_NO_ENCONTRADA"
    );
  }

  const estadoAnterior = (actual.estado ?? SOLICITUD_PENDIENTE) as EstadoSolicitud;

  // 🛡️ SEGURIDAD: un SOLICITANTE solo puede operar sobre sus propias solicitudes.
  if (rolUsuario === "SOLICITANTE" && actual.solicitanteid !== aprobadorId) {
    throw new SolicitudError(
      "No tienes permisos para modificar solicitudes ajenas.",
      403,
      "SIN_PERMISO"
    );
  }

  const permitidos = TRANSICIONES_PERMITIDAS[estadoAnterior] ?? [];
  if (!permitidos.includes(nuevoEstado)) {
    throw new SolicitudError(
      `Transición no permitida: ${estadoAnterior} → ${nuevoEstado}.` +
        (permitidos.length > 0
          ? ` Desde ${estadoAnterior} solo se puede pasar a: ${permitidos.join(", ")}.`
          : ` ${estadoAnterior} es un estado terminal.`),
      400,
      "TRANSICION_INVALIDA"
    );
  }

  const esAprobacion = nuevoEstado === SOLICITUD_APROBADA;
  const motivoLimpio = textoOpcional(motivo);

  await prisma.$transaction(async (tx) => {
    await tx.solicitud.update({
      where: { id },
      data: {
        estado: nuevoEstado,
        // Solo se fija el aprobador al aprobar: no se pisa en un rechazo.
        ...(esAprobacion ? { aprobadorid: aprobadorId } : {}),
      },
    });

    await registrarAuditoria(tx, {
      solicitudId: id,
      usuarioId: aprobadorId,
      accion: esAprobacion ? ACCION_AUDITORIA.APROBAR : ACCION_AUDITORIA.RECHAZAR,
      payload: {
        estadoAnterior,
        estadoNuevo: nuevoEstado,
        ...(motivoLimpio ? { motivo: motivoLimpio } : {}),
      },
    });
  });

  return getDetalleSolicitud(id);
}

// ===================================================
// ENTREGAR SOLICITUD (compuerta APROBADA + lock atómico)
// ===================================================
/**
 * Genera el documento de SALIDA (DESPACHO) o DEVOLUCION (DEVOLUCIÓN) y
 * cierra la solicitud como ENTREGADA.
 *
 * Reglas:
 *  - Solo se entrega una solicitud en estado **APROBADA**. Cualquier otro
 *    estado es 400 `SOLICITUD_NO_APROBADA` (409 si ya fue procesada).
 *  - El cambio a ENTREGADA se hace con un `updateMany` condicionado al estado
 *    APROBADA: si `count === 0` otra transacción ganó la carrera y se aborta
 *    con 409 `SOLICITUD_YA_PROCESADA`. Así la entrega es **idempotente**.
 *  - `solicitud.aprobadorid` NO se sobrescribe: conserva al usuario que
 *    aprobó. Quien entrega queda en `documento.creadorid` y en auditoría.
 *
 * Costeo congelado por línea (`documento_item.costounit` + `precioref`):
 *  - DESPACHO: `producto.precioref` > 0; si no, `costounit` del último
 *    documento_item de un INGRESO APROBADO del producto.
 *  - DEVOLUCIÓN con origen: hereda el `costounit` del documento de salida
 *    original; si el producto no estaba en el origen, cae a `precioref`.
 */
async function entregarSolicitud(
  id: string,
  entregadorId: string,
  rolUsuario?: string | null
): Promise<EntregarSolicitudResultadoDTO> {
  if (!entregadorId) {
    throw new SolicitudError(
      "Error de identidad: usuario no disponible.",
      403,
      "SIN_IDENTIDAD"
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const solicitud = await tx.solicitud.findUnique({
        where: { id },
        include: {
          bodega: { select: { id: true, nombre: true } },
          solicitud_item: {
            include: {
              producto: { select: { id: true, nombre: true, unidadid: true } },
            },
          },
        },
      });

      if (!solicitud) {
        throw new SolicitudError(
          `Solicitud ${id} no encontrada.`,
          404,
          "SOLICITUD_NO_ENCONTRADA"
        );
      }

      // 🛡️ Aislamiento: un SOLICITANTE no puede entregar solicitudes ajenas.
      if (rolUsuario === "SOLICITANTE" && solicitud.solicitanteid !== entregadorId) {
        throw new SolicitudError(
          "No tienes permisos para entregar solicitudes ajenas.",
          403,
          "SIN_PERMISO"
        );
      }

      // 🚧 COMPUERTA OBLIGATORIA: solo se despacha lo aprobado.
      if (solicitud.estado !== SOLICITUD_APROBADA) {
        const yaProcesada =
          solicitud.estado === SOLICITUD_ENTREGADA ||
          solicitud.estado === SOLICITUD_RECHAZADA;
        throw new SolicitudError(
          yaProcesada
            ? `La solicitud ${id} ya fue procesada (estado ${solicitud.estado}).`
            : `La solicitud ${id} debe estar APROBADA para entregarse (estado actual: ${solicitud.estado}).`,
          yaProcesada ? 409 : 400,
          yaProcesada ? "SOLICITUD_YA_PROCESADA" : "SOLICITUD_NO_APROBADA"
        );
      }

      if (solicitud.solicitud_item.length === 0) {
        throw new SolicitudError(
          "La solicitud no tiene líneas para entregar.",
          400,
          "SOLICITUD_SIN_ITEMS"
        );
      }

      const tipoReal = (solicitud.tipo ?? TIPO_SOLICITUD_DESPACHO) as TipoSolicitud;
      const esDespacho = tipoReal === TIPO_SOLICITUD_DESPACHO;
      const tipoDocumento = esDespacho ? TIPO_DOCUMENTO_SALIDA : TIPO_DOCUMENTO_DEVOLUCION;
      const prefijo = esDespacho ? "SAL" : "DEV";

      // Validación de stock al momento de la entrega (solo DESPACHO).
      if (esDespacho) {
        for (const item of solicitud.solicitud_item) {
          const ingresos = await tx.documento_item.aggregate({
            _sum: { cantidad: true },
            where: {
              productoid: item.productoid,
              documento: { tipo: TIPO_DOCUMENTO_INGRESO, estado: ESTADO_DOCUMENTO_APROBADO },
            },
          });
          const salidas = await tx.documento_item.aggregate({
            _sum: { cantidad: true },
            where: {
              productoid: item.productoid,
              documento: { tipo: TIPO_DOCUMENTO_SALIDA, estado: ESTADO_DOCUMENTO_APROBADO },
            },
          });
          const ajustes = await tx.documento_item.aggregate({
            _sum: { cantidad: true },
            where: {
              productoid: item.productoid,
              documento: { tipo: TIPO_DOCUMENTO_AJUSTE, estado: ESTADO_DOCUMENTO_APROBADO },
            },
          });
          const devInternas = await tx.documento_item.aggregate({
            _sum: { cantidad: true },
            where: {
              productoid: item.productoid,
              documento: {
                tipo: TIPO_DOCUMENTO_DEVOLUCION,
                estado: ESTADO_DOCUMENTO_APROBADO,
                proveedorid: null,
              },
            },
          });
          const devExternas = await tx.documento_item.aggregate({
            _sum: { cantidad: true },
            where: {
              productoid: item.productoid,
              documento: {
                tipo: TIPO_DOCUMENTO_DEVOLUCION,
                estado: ESTADO_DOCUMENTO_APROBADO,
                NOT: { proveedorid: null },
              },
            },
          });

          const stockFisicoAlMomento =
            (Number(ingresos._sum.cantidad) || 0) +
            (Number(devInternas._sum.cantidad) || 0) +
            (Number(ajustes._sum.cantidad) || 0) -
            (Number(salidas._sum.cantidad) || 0) -
            (Number(devExternas._sum.cantidad) || 0);

          if (stockFisicoAlMomento < Number(item.cantidad)) {
            throw new SolicitudError(
              `Stock insuficiente para "${item.producto?.nombre ?? item.productoid}": disponible ${stockFisicoAlMomento}, requerido ${item.cantidad}.`,
              400,
              "STOCK_INSUFICIENTE"
            );
          }
        }
      }

      // Consecutivo del documento.
      const anioActual = anioActualGT();
      let correlativo = 1;
      const contador = await tx.consecutivo.findUnique({
        where: { tipo_anio: { tipo: tipoDocumento, anio: anioActual } },
      });
      if (contador) {
        const upd = await tx.consecutivo.update({
          where: { id: contador.id },
          data: { ultimo: { increment: 1 } },
        });
        correlativo = upd.ultimo || 1;
      } else {
        await tx.consecutivo.create({
          data: { tipo: tipoDocumento, anio: anioActual, ultimo: 1, prefijo },
        });
      }
      const codigoDoc = `${prefijo}-${anioActual}-${String(correlativo).padStart(4, "0")}`;

      const documento = await tx.documento.create({
        data: {
          tipo: tipoDocumento,
          estado: ESTADO_DOCUMENTO_APROBADO,
          consecutivo: codigoDoc,
          fecha: new Date(),
          bodegaorigenid: esDespacho ? solicitud.bodegaid : null,
          bodegadestinoid: esDespacho ? null : solicitud.bodegaid,
          solicitanteid: solicitud.solicitanteid,
          creadorid: entregadorId,
          observacion: `Generado automáticamente desde Solicitud ${solicitud.id}`,
        },
      });

      // 🔒 BLOQUEO ATÓMICO: solo una transacción pasa APROBADA -> ENTREGADA.
      const locked = await tx.solicitud.updateMany({
        where: { id: solicitud.id, estado: SOLICITUD_APROBADA },
        data: { estado: SOLICITUD_ENTREGADA, documentosalidaid: documento.id },
      });

      if (locked.count === 0) {
        throw new SolicitudError(
          "La solicitud ya fue procesada o no está aprobada.",
          409,
          "SOLICITUD_YA_PROCESADA"
        );
      }

      // Costos heredados (solo DEVOLUCIÓN con origen).
      const origenDevolucion =
        !esDespacho && solicitud.solicitud_origen_id
          ? await cargarCostosOrigenDevolucion(tx, solicitud.solicitud_origen_id)
          : { porProducto: new Map<string, number>(), documentoSalidaId: null };

      const detalleCostos: Array<{
        productoId: string;
        costounit: number | null;
        origen: string;
      }> = [];

      // CPP de las devoluciones internas: stock y CPP antes de insertar las
      // nuevas líneas (se leen una sola vez para todos los productos).
      const idsProductos = [...new Set(solicitud.solicitud_item.map((i) => i.productoid))];
      const stockPrevioPorProducto = esDespacho
        ? {}
        : await stockFisicoPorProducto(tx, idsProductos);
      const productosConCpp = esDespacho
        ? []
        : await tx.producto.findMany({
            where: { id: { in: idsProductos } },
            select: { id: true, precioref: true },
          });
      const cppActualPorProducto = new Map(
        productosConCpp.map((p) => [p.id, aNumeroCompartido(p.precioref)])
      );
      // Acumula las cantidades devueltas por producto para ponderar una sola vez.
      const cantidadDevueltaPorProducto = new Map<string, { cantidad: number; valor: number }>();

      for (const item of solicitud.solicitud_item) {
        const unidadid = item.producto?.unidadid ?? item.unidadid;

        let costo: number | null = null;
        let origen = "SIN_COSTO";

        if (esDespacho) {
          const resuelto = await resolverCostoDespacho(tx, item.productoid);
          costo = resuelto.costounit;
          origen = resuelto.origen;

          // 🚫 BLOQUEO ESTRICTO: no se despacha un producto sin costo.
          if (costo === null) {
            throw new SolicitudError(
              `El producto ${item.producto?.nombre ?? item.productoid} no tiene precio de referencia configurado. Asigne un precio en Inventario antes de despachar.`,
              400,
              "PRODUCTO_SIN_COSTO"
            );
          }
        } else {
          // DEVOLUCIÓN: hereda el costo del documento de salida original.
          const heredado = origenDevolucion.porProducto.get(item.productoid);
          if (heredado !== undefined) {
            costo = heredado;
            origen = "ORIGEN_SALIDA";
          } else {
            const resuelto = await resolverCostoDespacho(tx, item.productoid);
            costo = resuelto.costounit;
            origen = resuelto.origen;
          }

          // Acumular para el CPP (cantidad devuelta * costo heredado).
          const cantidad = aNumeroCompartido(item.cantidad) ?? 0;
          if (costo !== null && cantidad > 0) {
            const prev = cantidadDevueltaPorProducto.get(item.productoid) ?? { cantidad: 0, valor: 0 };
            cantidadDevueltaPorProducto.set(item.productoid, {
              cantidad: prev.cantidad + cantidad,
              valor: prev.valor + cantidad * costo,
            });
          }
        }

        const precioref = normalizarPrecioref(costo);

        await tx.documento_item.create({
          data: {
            documentoid: documento.id,
            productoid: item.productoid,
            unidadid,
            loteid: item.loteid,
            cantidad: item.cantidad,
            costounit: costo === null ? null : new Prisma.Decimal(costo),
            precioref: precioref === null ? null : new Prisma.Decimal(precioref),
            notas: item.notas,
          },
        });

        detalleCostos.push({ productoId: item.productoid, costounit: costo, origen });
      }

      // ---------------------------------------------------------------
      // DEVOLUCIÓN INTERNA: ponderar el CPP con la cantidad devuelta.
      // cppNuevo = ((stockPrevio * cppActual) + (cantDevuelta * costo))
      //            / (stockPrevio + cantidadDevuelta)
      // ---------------------------------------------------------------
      if (!esDespacho) {
        for (const [productoId, { cantidad, valor }] of cantidadDevueltaPorProducto) {
          if (cantidad <= 0) continue;
          const costoPonderadoEntrada = valor / cantidad;
          const { cppNuevo } = calcularCpp({
            stockPrevio: stockPrevioPorProducto[productoId] ?? 0,
            cppActual: cppActualPorProducto.get(productoId) ?? null,
            cantidadIngreso: cantidad,
            costounit: costoPonderadoEntrada,
          });
          if (cppNuevo === null) continue;
          const valorDecimal = normalizarPrecioref(cppNuevo);
          if (valorDecimal === null) continue;
          await tx.producto.update({
            where: { id: productoId },
            data: { precioref: new Prisma.Decimal(valorDecimal) },
          });
        }
      }

      // Auditoría: ENTREGAR (quien entrega, no quien aprobó).
      await registrarAuditoria(tx, {
        solicitudId: solicitud.id,
        usuarioId: entregadorId,
        accion: ACCION_AUDITORIA.ENTREGAR,
        payload: {
          documentoId: documento.id,
          codigoDoc,
          tipoDocumento,
          aprobadorId: solicitud.aprobadorid ?? null,
          ...(origenDevolucion.documentoSalidaId
            ? { documentoOrigenCostosId: origenDevolucion.documentoSalidaId }
            : {}),
          costos: detalleCostos,
        },
      });

      return {
        solicitud: {
          id: solicitud.id,
          estado: SOLICITUD_ENTREGADA,
          aprobadorid: solicitud.aprobadorid ?? null,
          documentosalidaid: documento.id,
        },
        documentoId: documento.id,
        codigoDoc,
      };
    },
    { maxWait: 5000, timeout: 20000 }
  );
}

// ===================================================
// PDF DEL DETALLE DE SOLICITUD
// ===================================================
async function exportSolicitudDetallePDF(
  id: string
): Promise<{ filename: string; mime: string; content: Buffer }> {
  const det = await getDetalleSolicitud(id);

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: any) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err: any) => reject(err));

    doc.fontSize(14).text("DETALLE DE SOLICITUD", { align: "center" });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Código: ${det.id}`);
    doc.text(`Estado: ${det.estado}`);
    doc.text(`Tipo: ${det.tipo}`);
    // `det.fecha` es ISO 8601 en UTC: se re-parsea para formatear en hora GT.
    const fechaGT = det.fecha ? parsearFechaNegocioOpcional(det.fecha, true) : null;
    doc.text(`Fecha: ${fechaGT ? formatearFechaHoraGT(fechaGT) : "-"}`);
    doc.text(`Solicitante: ${det.solicitante.nombre}`);
    doc.text(`Aprobador: ${det.aprobador?.nombre ?? "-"}`);
    doc.text(`Bodega: ${det.bodega?.nombre ?? "-"}`);
    if (det.documentoSalidaId) {
      doc.text(`Documento: ${det.documentoSalidaConsecutivo ?? det.documentoSalidaId}`);
    }
    doc.moveDown();

    doc.fontSize(12).text("Productos", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);

    det.productos.forEach((p) => {
      doc.font("Helvetica-Bold").text(p.nombre);
      doc.font("Helvetica").text(`Código: ${p.codigo}   Cantidad: ${p.cantidad} ${p.unidad}`);
      doc.text(`Lote: ${p.loteCodigo}   Cultivo: ${p.cultivo}`);
      if (p.subtotal !== null) {
        doc.text(`Costo unitario: ${p.costounit}   Subtotal: ${p.subtotal.toFixed(2)}`);
      }
      doc.moveDown(0.5);
    });

    if (det.montoTotal !== null) {
      doc.moveDown();
      doc.font("Helvetica-Bold").text(`Monto total: ${det.montoTotal.toFixed(2)}`);
    }

    doc.end();
  });

  const safe = det.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return {
    filename: `solicitud_${safe}.pdf`,
    mime: "application/pdf",
    content: buffer,
  };
}

// ===================================================
// API PÚBLICA DEL SERVICIO
// ===================================================
const solicitudesService = {
  getSolicitudes,
  getDetalleSolicitud,
  crearSolicitud,
  actualizarEstadoSolicitud,
  entregarSolicitud,
  exportSolicitudDetallePDF,
  existeSolicitud,
  getSolicitanteId,
};

export default solicitudesService;
