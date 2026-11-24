import prisma from "../../core/prisma";
import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";

// =============================
// Error de negocio tipado
// =============================
/**
 * Error controlado del dominio de movimientos.
 * Permite que la capa HTTP traduzca reglas de negocio a status codes
 * (400 / 404 / 409) en lugar de devolver siempre 500.
 */
export class MovimientoError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public codigo?: string
  ) {
    super(message);
    this.name = "MovimientoError";
  }
}

// =============================
// Helper para construir PDFs
// =============================
async function buildPDF(build: (doc: any) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: any) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err: any) => reject(err));
    build(doc);
    doc.end();
  });
}

// =============================
// Tipos DTO para el frontend
// =============================
export type MovimientoTipo = "INGRESO" | "SALIDA" | "TRANSFERENCIA" | "AJUSTE" | "DEVOLUCION";
export type MovimientoEstado = "BORRADOR" | "APROBADO" | "ANULADO";

/**
 * Roles autorizados a ver importes (`montoTotal`, `costounit`, `subtotal`).
 * El resto (SOLICITANTE, VISOR, COSECHA) recibe `null` en esos campos.
 */
const ROLES_CON_COSTOS = new Set<string>(["ADMIN", "BODEGUERO"]);

/** Indica si el rol puede ver importes monetarios. */
export function puedeVerCostos(rol?: string | null): boolean {
  return !!rol && ROLES_CON_COSTOS.has(rol);
}

/** Cantidad máxima de nombres de producto que devuelve `resumenProductos`. */
const RESUMEN_PRODUCTOS_MAX = 2;

/** Rango máximo aceptado entre `fechaInicio` y `fechaFin`, en días. */
export const RANGO_MAXIMO_DIAS = 366;

export type BodegaRefDTO = { id: string; nombre: string } | null;
export type ProveedorRefDTO = { id: string; nombre: string; nit: string | null } | null;
export type UsuarioRefDTO = { id: string; nombre: string } | null;
export type ComprobanteRefDTO = {
  tipocomprobante: string;
  numero: string;
  serie: string | null;
} | null;

/** Fila del listado paginado (`GET /api/movimientos`). */
export type MovimientoResumenDTO = {
  id: string;
  consecutivo: string | null;
  /** `consecutivo` o, en su defecto, el `id`. */
  codigo: string;
  tipo: MovimientoTipo;
  estado: MovimientoEstado;
  fecha: string | null;
  createdat?: string;

  bodegaOrigen: BodegaRefDTO;
  bodegaDestino: BodegaRefDTO;
  proveedor: ProveedorRefDTO;
  solicitante: UsuarioRefDTO;
  creador: UsuarioRefDTO;
  comprobante: ComprobanteRefDTO;

  /** Número de líneas del documento. */
  totalProductos: number;
  /** Hasta `RESUMEN_PRODUCTOS_MAX` nombres de producto, sin repetir. */
  resumenProductos: string[];

  /** `null` si el rol no puede ver importes o ninguna línea tiene costo. */
  montoTotal: number | null;

  observacion: string | null;

  // ---- Legacy (compatibilidad con el frontend actual) ----
  /** Alias de `bodegaOrigen.nombre`. */
  origen: string | null;
  /** Alias de `bodegaDestino.nombre`. */
  destino: string | null;
  /** Texto `"N productos"`. */
  productos: string;
};

/** Línea de detalle (`GET /api/movimientos/:id`). */
export type ProductoEnMovimientoDTO = {
  id: string;
  productoNombre: string;
  productoCodigo: string;
  /** Texto listo para pintar, p. ej. `"12.5 L"`. */
  cantidad: string;
  cantidadNumero: number;
  unidad: string;
  unidadId: string;
  loteCodigo: string | null;
  loteId: string | null;
  fincaNombre: string | null;
  notas: string | null;
  /** `null` si el rol no puede ver importes o la línea no tiene costo. */
  costounit: number | null;
  /** `cantidad * costounit`. `null` en las mismas condiciones que `costounit`. */
  subtotal: number | null;
};

/** Detalle de un documento (`GET /api/movimientos/:id`). */
export type MovimientoDetalleDTO = {
  id: string;
  codigo: string;
  consecutivo?: string;
  tipo: MovimientoTipo;
  estado: MovimientoEstado;
  fecha: string | null;
  createdat?: string;

  bodegaOrigen: BodegaRefDTO;
  bodegaDestino: BodegaRefDTO;
  proveedor: ProveedorRefDTO;
  solicitante: UsuarioRefDTO;
  creador: UsuarioRefDTO;
  comprobante: ComprobanteRefDTO;
  observacion: string | null;

  productos: ProductoEnMovimientoDTO[];
  totalProductos: number;
  /** `null` si el rol no puede ver importes. */
  montoTotal: number | null;

  // ---- Legacy (compatibilidad) ----
  origen: string | null;
  destino: string | null;
};

// =============================
// Ingreso: tipos de entrada / salida
// =============================
export type IngresoItemInput = {
  productoId?: string;
  cantidad?: unknown;
  costo?: unknown;
  loteId?: string | null;
  /** Precio de referencia del producto al momento del ingreso (informativo). */
  precioref?: unknown;
};

export type RegistrarIngresoInput = {
  bodegaId?: string;
  proveedorId?: string | null;
  fecha?: string;
  tipoComprobante?: string;
  factura?: string;
  serie?: string | null;
  uuid?: string | null;
  observaciones?: string;
  items?: IngresoItemInput[];
};

export type IngresoLineaResultadoDTO = {
  productoid: string;
  nombre: string;
  cantidad: number;
  costoUnitario: number;
  unidad: string;
  loteId: string | null;
  preciorefActualizado: number;
};

export type IngresoDocumentoDTO = {
  id: string;
  consecutivo: string;
  tipo: "INGRESO";
  estado: MovimientoEstado;
  fecha: string;
  bodegaId: string;
  bodegaNombre: string;
  proveedorId: string | null;
  proveedorNombre: string | null;
  observaciones: string;
  creadorId: string;
  comprobanteFiscal: {
    id: string;
    tipocomprobante: string;
    numero: string;
    serie: string | null;
    nitemisor: string;
  } | null;
  items: IngresoLineaResultadoDTO[];
};

// =============================
// Helpers de validación
// =============================
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function textoOpcional(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const limpio = String(value).trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * Convierte a número aceptando "1,5" (coma decimal) además de "1.5".
 *
 * Importante: Prisma devuelve las columnas `Decimal` como objetos
 * (`Prisma.Decimal`), no como `number`. Sin este caso, cualquier importe
 * leído de BD se interpretaría como `null`.
 */
function aNumero(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const limpio = value.trim().replace(",", ".");
    if (limpio === "") return null;
    const n = Number(limpio);
    return Number.isFinite(n) ? n : null;
  }
  // Prisma.Decimal y cualquier objeto con `toNumber()`/`toFixed()`
  if (typeof value === "object") {
    const obj = value as { toNumber?: () => number; toString?: () => string };
    if (typeof obj.toNumber === "function") {
      const n = obj.toNumber();
      return Number.isFinite(n) ? n : null;
    }
    if (typeof obj.toString === "function") {
      const n = Number(obj.toString());
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

/**
 * Error genérico de validación (siempre 400) con código para que el
 * frontend pueda resaltar el campo culpable.
 */
function errorValidacion(message: string, codigo: string): MovimientoError {
  return new MovimientoError(message, 400, codigo);
}

/**
 * Indica si TODAS las líneas de un producto llegaron sin costo.
 * En ese caso no se sobrescribe `precioref` con 0, se conserva el vigente.
 */
function costoTodosOmitidos(
  lineas: { productoId: string; costoOmitido: boolean }[],
  productoId: string
): boolean {
  const delProducto = lineas.filter((l) => l.productoId === productoId);
  return delProducto.length > 0 && delProducto.every((l) => l.costoOmitido);
}

// ---------------------------------------------------------------------
// CALCULAR MODA (precio de referencia)
// ---------------------------------------------------------------------
/**
 * Devuelve el precio que más se repite. En caso de empate gana el primero
 * recibido (el caller lo invoca con los precios ordenados del más reciente
 * al más antiguo, por lo que el empate se resuelve hacia lo reciente).
 */
function calcularModa(precios: number[]): number {
  if (precios.length === 0) return 0;

  const frecuencia = new Map<number, number>();
  let maxFrecuencia = 0;
  let moda = precios[0];

  for (const p of precios) {
    const actual = (frecuencia.get(p) ?? 0) + 1;
    frecuencia.set(p, actual);

    if (actual > maxFrecuencia) {
      maxFrecuencia = actual;
      moda = p;
    }
  }
    return moda;
}

// ---------------------------------------------------------------------
// ZONA HORARIA: America/Guatemala (UTC-6 todo el año, sin horario de verano)
// ---------------------------------------------------------------------
const OFFSET_GUATEMALA_MS = 6 * 60 * 60 * 1000;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Formato de fecha "solo día" aceptado en query string. */
const SOLO_FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Redondea a 2 decimales evitando artefactos de punto flotante. */
function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Verifica que `YYYY-MM-DD` exista realmente (rechaza 2026-02-31). */
function esFechaCalendarioValida(fecha: string): boolean {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    d.getUTCFullYear() === anio &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
}

/** Instante UTC de las 00:00:00.000 locales de Guatemala para `YYYY-MM-DD`. */
function inicioDelDiaGuatemala(fecha: string): Date {
  const utcMedianoche = Date.parse(`${fecha}T00:00:00.000Z`);
  return new Date(utcMedianoche + OFFSET_GUATEMALA_MS);
}

export type RangoFechasNormalizado = {
  fechaInicio?: Date;
  fechaFin?: Date;
  /** Inicio del día siguiente al `fechaFin` (límite exclusivo). */
  finExclusivo?: Date;
};

/**
 * Normaliza el rango de fechas recibido por query string.
 *
 * - Acepta `YYYY-MM-DD` (interpretado en America/Guatemala) o ISO 8601.
 * - `fechaInicio` se expande al inicio del día y `fechaFin` al último
 *   instante de ese día: `?fechaInicio=2026-03-01&fechaFin=2026-03-01`
 *   cubre el 1 de marzo completo en hora de Guatemala.
 * - Valida formato, orden y rango máximo.
 *
 * Lanza `MovimientoError` (400) si algún valor es inválido.
 */
export function normalizarRangoFechas(
  fechaInicioRaw?: unknown,
  fechaFinRaw?: unknown
): RangoFechasNormalizado {
  const inicioStr = textoOpcional(fechaInicioRaw);
  const finStr = textoOpcional(fechaFinRaw);

  let fechaInicio: Date | undefined;
  let fechaFin: Date | undefined;
  let finExclusivo: Date | undefined;

  if (inicioStr) {
    if (SOLO_FECHA_REGEX.test(inicioStr)) {
      if (!esFechaCalendarioValida(inicioStr)) {
        throw errorValidacion("'fechaInicio' no es una fecha válida.", "FECHA_INICIO_INVALIDA");
      }
      fechaInicio = inicioDelDiaGuatemala(inicioStr);
    } else {
      const d = new Date(inicioStr);
      if (Number.isNaN(d.getTime())) {
        throw errorValidacion("'fechaInicio' no es una fecha válida.", "FECHA_INICIO_INVALIDA");
      }
      fechaInicio = d;
    }
  }

  if (finStr) {
    if (SOLO_FECHA_REGEX.test(finStr)) {
      if (!esFechaCalendarioValida(finStr)) {
        throw errorValidacion("'fechaFin' no es una fecha válida.", "FECHA_FIN_INVALIDA");
      }
      const inicioDelDia = inicioDelDiaGuatemala(finStr);
      finExclusivo = new Date(inicioDelDia.getTime() + MS_POR_DIA);
      fechaFin = new Date(finExclusivo.getTime() - 1);
    } else {
      const d = new Date(finStr);
      if (Number.isNaN(d.getTime())) {
        throw errorValidacion("'fechaFin' no es una fecha válida.", "FECHA_FIN_INVALIDA");
      }
      fechaFin = d;
    }
  }

  if (fechaInicio && fechaFin && fechaInicio.getTime() > fechaFin.getTime()) {
    throw errorValidacion(
      "'fechaInicio' no puede ser posterior a 'fechaFin'.",
      "RANGO_FECHAS_INVALIDO"
    );
  }

  if (fechaInicio && fechaFin) {
    const dias = (fechaFin.getTime() - fechaInicio.getTime()) / MS_POR_DIA;
    if (dias > RANGO_MAXIMO_DIAS) {
      throw errorValidacion(
        `El rango de fechas no puede superar ${RANGO_MAXIMO_DIAS} días.`,
        "RANGO_FECHAS_EXCEDIDO"
      );
    }
  }

    return { fechaInicio, fechaFin, finExclusivo };
}

// ---------------------------------------------------------------------
// Filtros del listado
// ---------------------------------------------------------------------
export const LIMITE_PAGINA_DEFAULT = 15;
export const LIMITE_PAGINA_MAX = 100;

/** Filtros ya normalizados (fechas como `Date`). */
export type MovimientosFiltros = {
  tipo?: MovimientoTipo;
  estado?: MovimientoEstado;
  proveedorId?: string;
  solicitanteId?: string;
  /** Coincide con `bodegaorigenid` **o** `bodegadestinoid`. */
  bodegaId?: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  q?: string;
};

export type MovimientosPaginacion = { page: number; limit: number };

export type MovimientosPaginaDTO = {
  data: MovimientoResumenDTO[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

/** Usuario autenticado mínimo para aplicar aislamiento por rol. */
export type UsuarioContexto = { id: string; rol?: string | null } | undefined | null;

/**
 * Construye el `where` de Prisma para el listado y el export.
 *
 * Aislamiento por rol:
 *  - `SOLICITANTE` -> solo sus documentos. Se aplica **al final**, por lo
 *    que **pisa** cualquier `solicitanteId` recibido por query string.
 *
 * `q` busca (case-insensitive) por `consecutivo`, número/serie del
 * comprobante, o nombre/código de producto de alguna línea.
 */
export function buildWhereMovimientos(
  filtros: MovimientosFiltros = {},
  usuario?: UsuarioContexto
): Prisma.documentoWhereInput {
  const where: Prisma.documentoWhereInput = {};

  if (filtros.tipo) where.tipo = filtros.tipo;
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.proveedorId) where.proveedorid = filtros.proveedorId;
  if (filtros.solicitanteId) where.solicitanteid = filtros.solicitanteId;

  // Una bodega puede ser la de origen o la de destino del movimiento.
  if (filtros.bodegaId) {
    where.OR = [
      { bodegaorigenid: filtros.bodegaId },
      { bodegadestinoid: filtros.bodegaId },
    ];
  }

  if (filtros.fechaInicio || filtros.fechaFin) {
    const fecha: Prisma.DateTimeNullableFilter = {};
    if (filtros.fechaInicio) fecha.gte = filtros.fechaInicio;
    if (filtros.fechaFin) fecha.lte = filtros.fechaFin;
    where.fecha = fecha;
  }

  const q = textoOpcional(filtros.q);

  // El filtro de bodega ya usa `OR`. Si además hay `q`, no podemos tener
  // dos claves `OR` en el mismo objeto (la segunda pisaría a la primera),
  // así que combinamos ambos grupos con `AND`.
  if (q) {
    const orBusqueda: Prisma.documentoWhereInput[] = [
      { consecutivo: { contains: q, mode: "insensitive" } },
      { comprobante_fiscal: { is: { numero: { contains: q, mode: "insensitive" } } } },
      { comprobante_fiscal: { is: { serie: { contains: q, mode: "insensitive" } } } },
      {
        documento_item: {
          some: {
            OR: [
              { producto: { nombre: { contains: q, mode: "insensitive" } } },
              { producto: { codigo: { contains: q, mode: "insensitive" } } },
            ],
          },
        },
      },
    ];

    if (where.OR) {
      const orBodega = where.OR;
      delete where.OR;
      where.AND = [{ OR: orBodega }, { OR: orBusqueda }];
    } else {
      where.OR = orBusqueda;
    }
  }

  // Aislamiento por rol: al final para que siempre gane.
  if (usuario && usuario.rol === "SOLICITANTE") {
    where.solicitanteid = usuario.id;
  }

  return where;
}

// ---------------------------------------------------------------------
// Serialización
// ---------------------------------------------------------------------
/** Proyección compartida por listado y export. */
const INCLUDE_RESUMEN = {
  proveedor: { select: { id: true, nombre: true, nit: true } },
  bodega_documento_bodegaorigenidTobodega: { select: { id: true, nombre: true } },
  bodega_documento_bodegadestinoidTobodega: { select: { id: true, nombre: true } },
  usuario_documento_solicitanteidTousuario: { select: { id: true, nombre: true } },
  usuario_documento_creadoridTousuario: { select: { id: true, nombre: true } },
  comprobante_fiscal: { select: { tipocomprobante: true, numero: true, serie: true } },
  documento_item: {
    select: { cantidad: true, costounit: true, producto: { select: { nombre: true } } },
  },
} as const;

type DocumentoParaResumen = Prisma.documentoGetPayload<{ include: typeof INCLUDE_RESUMEN }>;

function aResumen(d: DocumentoParaResumen, verCostos: boolean): MovimientoResumenDTO {
  // Nombres de producto únicos, conservando el orden de las líneas.
  const nombresUnicos: string[] = [];
  for (const item of d.documento_item) {
    const nombre = item.producto?.nombre;
    if (nombre && !nombresUnicos.includes(nombre)) nombresUnicos.push(nombre);
  }

  let montoTotal: number | null = null;
  if (verCostos) {
    let acumulado = 0;
    let hayCosto = false;
    for (const item of d.documento_item) {
      const costo = aNumero(item.costounit);
      if (costo === null) continue;
      hayCosto = true;
      acumulado += (Number(item.cantidad) || 0) * costo;
    }
    montoTotal = hayCosto ? redondear2(acumulado) : null;
  }

  const bodegaOrigen = d.bodega_documento_bodegaorigenidTobodega
    ? {
        id: d.bodega_documento_bodegaorigenidTobodega.id,
        nombre: d.bodega_documento_bodegaorigenidTobodega.nombre,
      }
    : null;
  const bodegaDestino = d.bodega_documento_bodegadestinoidTobodega
    ? {
        id: d.bodega_documento_bodegadestinoidTobodega.id,
        nombre: d.bodega_documento_bodegadestinoidTobodega.nombre,
      }
    : null;

  return {
    id: d.id,
    consecutivo: d.consecutivo ?? null,
    codigo: d.consecutivo ?? d.id,
    tipo: d.tipo as MovimientoTipo,
    estado: (d.estado ?? "BORRADOR") as MovimientoEstado,
    fecha: d.fecha ? d.fecha.toISOString() : null,
    createdat: d.createdat ? d.createdat.toISOString() : undefined,

    bodegaOrigen,
    bodegaDestino,
    proveedor: d.proveedor
      ? { id: d.proveedor.id, nombre: d.proveedor.nombre, nit: d.proveedor.nit ?? null }
      : null,
    solicitante: d.usuario_documento_solicitanteidTousuario
      ? {
          id: d.usuario_documento_solicitanteidTousuario.id,
          nombre: d.usuario_documento_solicitanteidTousuario.nombre,
        }
      : null,
    creador: d.usuario_documento_creadoridTousuario
      ? {
          id: d.usuario_documento_creadoridTousuario.id,
          nombre: d.usuario_documento_creadoridTousuario.nombre,
        }
      : null,
    comprobante: d.comprobante_fiscal
      ? {
          tipocomprobante: d.comprobante_fiscal.tipocomprobante,
          numero: d.comprobante_fiscal.numero,
          serie: d.comprobante_fiscal.serie ?? null,
        }
      : null,

    totalProductos: d.documento_item.length,
    resumenProductos: nombresUnicos.slice(0, RESUMEN_PRODUCTOS_MAX),
    montoTotal,
    observacion: d.observacion ?? null,

    origen: bodegaOrigen?.nombre ?? null,
    destino: bodegaDestino?.nombre ?? null,
    productos: `${d.documento_item.length} productos`,
  };
}

// =============================
// Servicio
// =============================
export const movimientosService = {

  // ---------------------------------------
  // REGISTRAR INGRESO (entrada a inventario)
  // ---------------------------------------
  /**
   * Registra un documento INGRESO con sus líneas dentro de una transacción.
   *
   * Reglas de negocio aplicadas:
   *  - `bodegaId` debe existir y `items` debe traer al menos 1 línea.
   *  - Cada línea: `productoId` existente, `cantidad > 0`, `costo >= 0`
   *    (un `costo` vacío/nulo se interpreta como 0, ver `costoOmitido` en la línea).
   *  - Si viene `loteId`, el lote debe existir.
   *  - Si viene `proveedorId`, el proveedor debe existir.
   *  - Si hay `proveedorId` + `factura`, no puede repetirse el comprobante
   *    `(proveedorid, numero, serie)` — con `serie` nula se compara solo
   *    `(proveedorid, numero)`.
   *  - Recalcula `producto.precioref` con la moda de los últimos ingresos.
   *
   * Lanza `MovimientoError` (400/404/409) para errores de negocio.
   */
  async registrarIngreso(input: RegistrarIngresoInput, creadorId: string): Promise<IngresoDocumentoDTO> {
    if (!creadorId) {
      throw new MovimientoError("Error de identidad: usuario creador no disponible.", 403, "SIN_IDENTIDAD");
    }

    // ---------- 1. Validaciones de cabecera ----------
    const bodegaId = textoOpcional(input.bodegaId);
    if (!bodegaId) {
      throw errorValidacion("El campo 'bodegaId' es obligatorio.", "BODEGA_REQUERIDA");
    }

    const items = input.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw errorValidacion("Debes incluir al menos un producto en 'items'.", "ITEMS_VACIOS");
    }
    if (items.length > 200) {
      throw errorValidacion("El ingreso no puede tener más de 200 líneas.", "ITEMS_LIMITE");
    }

    // Normalizar y validar cada línea ANTES de abrir la transacción
    const lineas: { productoId: string; cantidad: number; costo: number; costoOmitido: boolean; loteId: string | null }[] = [];

    items.forEach((item, index) => {
      const n = index + 1;
      const productoId = textoOpcional(item?.productoId);
      if (!productoId) {
        throw errorValidacion(`Línea ${n}: el campo 'productoId' es obligatorio.`, "PRODUCTO_ID_REQUERIDO");
      }
      if (!UUID_REGEX.test(productoId)) {
        throw errorValidacion(`Línea ${n}: 'productoId' no tiene un formato válido.`, "PRODUCTO_ID_INVALIDO");
      }

      const cantidad = aNumero(item?.cantidad);
      if (cantidad === null) {
        throw errorValidacion(`Línea ${n}: la 'cantidad' es obligatoria y debe ser numérica.`, "CANTIDAD_INVALIDA");
      }
      if (cantidad <= 0) {
        throw errorValidacion(`Línea ${n}: la 'cantidad' debe ser mayor a 0.`, "CANTIDAD_NO_POSITIVA");
      }

      // costo vacío/nulo => 0 (regla acordada); costo inválido o negativo => 400
      const costoCrudo = item?.costo;
      const costoOmitido = costoCrudo === undefined || costoCrudo === null || costoCrudo === "";
      const costo = costoOmitido ? 0 : aNumero(costoCrudo);
      if (costo === null) {
        throw errorValidacion(`Línea ${n}: el 'costo' debe ser numérico.`, "COSTO_INVALIDO");
      }
      if (costo < 0) {
        throw errorValidacion(`Línea ${n}: el 'costo' no puede ser negativo.`, "COSTO_NEGATIVO");
      }

      const loteId = textoOpcional(item?.loteId);

      lineas.push({ productoId, cantidad, costo, costoOmitido, loteId });
    });

    const proveedorId = textoOpcional(input.proveedorId);
    if (proveedorId && !UUID_REGEX.test(proveedorId)) {
      throw errorValidacion("'proveedorId' no tiene un formato válido.", "PROVEEDOR_ID_INVALIDO");
    }

    const factura = textoOpcional(input.factura);
    const serie = textoOpcional(input.serie);
    const tipoComprobante = textoOpcional(input.tipoComprobante) ?? "FACTURA";
    const uuidFiscal = textoOpcional(input.uuid);
    const observaciones = textoOpcional(input.observaciones) ?? "";

    // ---------- 2. Validaciones contra BD ----------
    const bodega = await prisma.bodega.findUnique({ where: { id: bodegaId }, select: { id: true, nombre: true } });
    if (!bodega) {
      throw new MovimientoError("La bodega indicada no existe.", 404, "BODEGA_NO_ENCONTRADA");
    }

    let proveedor: { id: string; nombre: string; nit: string | null } | null = null;
    if (proveedorId) {
      proveedor = await prisma.proveedor.findUnique({
        where: { id: proveedorId },
        select: { id: true, nombre: true, nit: true },
      });
      if (!proveedor) {
        throw new MovimientoError("El proveedor indicado no existe.", 404, "PROVEEDOR_NO_ENCONTRADO");
      }
    }

    // Productos: una sola consulta para todas las líneas (evita N+1)
    const productoIds = [...new Set(lineas.map((l) => l.productoId))];
    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: { id: true, nombre: true, unidadid: true },
    });
    const productosMap = new Map(productos.map((p) => [p.id, p]));

    const faltantes = productoIds.filter((id) => !productosMap.has(id));
    if (faltantes.length > 0) {
      throw new MovimientoError(
        `Producto no encontrado: ${faltantes.join(", ")}`,
        404,
        "PRODUCTO_NO_ENCONTRADO"
      );
    }

    // Lotes opcionales
    const loteIds = [...new Set(lineas.map((l) => l.loteId).filter((id): id is string => !!id))];
    if (loteIds.length > 0) {
      const lotes = await prisma.lote.findMany({ where: { id: { in: loteIds } }, select: { id: true } });
      const lotesValidos = new Set(lotes.map((l) => l.id));
      const loteFaltante = loteIds.find((id) => !lotesValidos.has(id));
      if (loteFaltante) {
        throw new MovimientoError(`Lote no encontrado: ${loteFaltante}`, 404, "LOTE_NO_ENCONTRADO");
      }
    }

    // ---------- 3. Prevención de factura duplicada ----------
    if (proveedorId && factura) {
      const duplicado = await prisma.comprobante_fiscal.findFirst({
        where: serie
          ? { numero: factura, serie, documento: { proveedorid: proveedorId } }
          : { numero: factura, documento: { proveedorid: proveedorId } },
        select: { id: true, documentoid: true },
      });

      if (duplicado) {
        throw new MovimientoError(
          "Esta factura ya fue registrada para este proveedor",
          409,
          "FACTURA_DUPLICADA"
        );
      }
    }

    // ---------- 4. Escritura transaccional ----------
    const documento = await prisma.$transaction(
      async (tx) => {
        const anioActual = new Date().getFullYear();
        let nuevoCorrelativo = 1;

        const contador = await tx.consecutivo.findUnique({
          where: { tipo_anio: { tipo: "INGRESO", anio: anioActual } },
        });

        if (contador) {
          const actualizado = await tx.consecutivo.update({
            where: { id: contador.id },
            data: { ultimo: { increment: 1 } },
          });
          nuevoCorrelativo = actualizado.ultimo ?? 1;
        } else {
          await tx.consecutivo.create({
            data: { tipo: "INGRESO", anio: anioActual, ultimo: 1, prefijo: "ING" },
          });
          nuevoCorrelativo = 1;
        }

        const codigoGenerado = `ING-${anioActual}-${nuevoCorrelativo.toString().padStart(4, "0")}`;
        const fechaDocumento = input.fecha ? new Date(input.fecha) : new Date();
        const fechaValida = Number.isNaN(fechaDocumento.getTime()) ? new Date() : fechaDocumento;

        const docCreado = await tx.documento.create({
          data: {
            tipo: "INGRESO",
            estado: "APROBADO",
            consecutivo: codigoGenerado,
            fecha: fechaValida,
            bodegadestinoid: bodega.id,
            proveedorid: proveedorId,
            creadorid: creadorId,
            observacion: observaciones,
          },
        });

        // Comprobante fiscal (solo si hay proveedor + número de factura)
        let comprobante: IngresoDocumentoDTO["comprobanteFiscal"] = null;
        if (proveedorId && factura) {
          const cf = await tx.comprobante_fiscal.create({
            data: {
              documentoid: docCreado.id,
              tipocomprobante: tipoComprobante,
              nitemisor: proveedor?.nit ?? "CF",
              numero: factura,
              serie,
              uuid: uuidFiscal,
              fechaemision: fechaValida,
            },
            select: { id: true, tipocomprobante: true, numero: true, serie: true, nitemisor: true },
          });
          comprobante = cf;
        }

        const resultadoLineas: IngresoLineaResultadoDTO[] = [];

        // Agrupar por producto para recalcular `precioref` una sola vez por producto
        const nuevoCostoPorProducto = new Map<string, number>();
        for (const linea of lineas) {
          if (!nuevoCostoPorProducto.has(linea.productoId)) {
            nuevoCostoPorProducto.set(linea.productoId, linea.costo);
          }
        }

        for (const linea of lineas) {
          const producto = productosMap.get(linea.productoId)!;

          await tx.documento_item.create({
            data: {
              documentoid: docCreado.id,
              productoid: linea.productoId,
              cantidad: new Prisma.Decimal(linea.cantidad),
              costounit: new Prisma.Decimal(linea.costo),
              unidadid: producto.unidadid,
              loteid: linea.loteId,
            },
          });

          resultadoLineas.push({
            productoid: linea.productoId,
            nombre: producto.nombre,
            cantidad: linea.cantidad,
            costoUnitario: linea.costo,
            unidad: producto.unidadid,
            loteId: linea.loteId,
            preciorefActualizado: 0, // se completa tras recalcular
          });
        }

        // Recalcular `precioref` con la moda (solo productos con costo real informado)
        for (const [productoId, costoNuevo] of nuevoCostoPorProducto) {
          const costoOmitido = costoTodosOmitidos(lineas, productoId);

          const ultimosIngresos = await tx.documento_item.findMany({
            where: {
              productoid: productoId,
              documento: { tipo: "INGRESO", estado: "APROBADO" },
            },
            orderBy: { createdat: "desc" },
            take: 10,
            select: { costounit: true },
          });

          const precios = ultimosIngresos
            .map((u) => aNumero(u.costounit))
            .filter((p): p is number => p !== null);

          if (precios.length === 0) precios.push(costoNuevo);

          const nuevoPrecioRef = calcularModa(precios);

          if (!(costoOmitido && nuevoPrecioRef === 0)) {
            await tx.producto.update({
              where: { id: productoId },
              data: { precioref: new Prisma.Decimal(nuevoPrecioRef) },
            });
          }

          for (const r of resultadoLineas) {
            if (r.productoid === productoId) r.preciorefActualizado = nuevoPrecioRef;
          }
        }

        return {
          id: docCreado.id,
          consecutivo: codigoGenerado,
          tipo: "INGRESO" as const,
          estado: (docCreado.estado ?? "APROBADO") as MovimientoEstado,
          fecha: fechaValida.toISOString(),
          bodegaId: bodega.id,
          bodegaNombre: bodega.nombre,
          proveedorId: proveedor?.id ?? null,
          proveedorNombre: proveedor?.nombre ?? null,
          observaciones,
          creadorId,
          comprobanteFiscal: comprobante,
          items: resultadoLineas,
        };
      },
      { maxWait: 5000, timeout: 20000 }
    );

    return documento;
  },

  // ---------------------------------------
  // LISTADO DE DOCUMENTOS / MOVIMIENTOS
  // ---------------------------------------
    /**
   * Listado paginado con filtros y aislamiento por rol.
   * Los importes se ocultan (`null`) si el rol no puede verlos.
   */
  async getListadoMovimientos(
    filtros: MovimientosFiltros = {},
    paginacion: MovimientosPaginacion = { page: 1, limit: LIMITE_PAGINA_DEFAULT },
    usuario?: UsuarioContexto
  ): Promise<MovimientosPaginaDTO> {
    const where = buildWhereMovimientos(filtros, usuario);
    const page = Math.max(1, Math.trunc(paginacion.page) || 1);
    const limit = Math.min(
      LIMITE_PAGINA_MAX,
      Math.max(1, Math.trunc(paginacion.limit) || LIMITE_PAGINA_DEFAULT)
    );
    const verCostos = puedeVerCostos(usuario?.rol);

    const [total, documentos] = await Promise.all([
      prisma.documento.count({ where }),
      prisma.documento.findMany({
        where,
        orderBy: [{ fecha: "desc" }, { createdat: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE_RESUMEN,
      }),
    ]);

    return {
      data: documentos.map((d) => aResumen(d, verCostos)),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  // ---------------------------------------
  // DETALLE DE UN DOCUMENTO / MOVIMIENTO
  // ---------------------------------------
    async getDetalleMovimiento(
    idOrCodigo: string,
    usuario?: UsuarioContexto
  ): Promise<MovimientoDetalleDTO> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCodigo);
    const whereClause: Prisma.documentoWhereInput = isUuid
      ? { id: idOrCodigo }
      : { consecutivo: idOrCodigo };

    // Aislamiento: un SOLICITANTE solo puede ver sus propios documentos.
    if (usuario && usuario.rol === "SOLICITANTE") {
      whereClause.solicitanteid = usuario.id;
    }

    const doc = await prisma.documento.findFirst({
      where: whereClause,
      include: {
        proveedor: true,
        bodega_documento_bodegaorigenidTobodega: true,
        bodega_documento_bodegadestinoidTobodega: true,
        usuario_documento_creadoridTousuario: true,
        usuario_documento_solicitanteidTousuario: true,
        comprobante_fiscal: true,
        solicitud: true,
        documento_item: {
          include: {
            producto: true,
            unidad: true,
            lote: { include: { finca: true } },
          },
        },
      },
    });

    if (!doc) {
            throw new MovimientoError(
        "El movimiento solicitado no existe o no tienes acceso a él.",
        404,
        "MOVIMIENTO_NO_ENCONTRADO"
      );
    }

    const origen = doc.bodega_documento_bodegaorigenidTobodega?.nombre ?? null;
    const destino = doc.bodega_documento_bodegadestinoidTobodega?.nombre ?? null;
    const proveedor = doc.proveedor?.nombre ?? null;
    const solicitante = doc.usuario_documento_solicitanteidTousuario?.nombre ?? null;
    const creador = doc.usuario_documento_creadoridTousuario?.nombre ?? null;

        const verCostos = puedeVerCostos(usuario?.rol);

    const productos: ProductoEnMovimientoDTO[] = doc.documento_item.map((item) => {
      const cantidadNum = Number(item.cantidad) || 0;
      const unidad = item.unidad?.abreviatura ?? "";
      const loteCodigo = item.lote?.codigo ?? null;
      const loteId = item.lote?.id ?? null;
      const fincaNombre = item.lote?.finca?.nombre ?? null;
      const costoLinea = verCostos ? aNumero(item.costounit) : null;

      return {
        id: item.id,
        productoNombre: item.producto?.nombre ?? "",
        productoCodigo: item.producto?.codigo ?? "",
        cantidad: `${cantidadNum} ${unidad}`.trim(),
        cantidadNumero: cantidadNum,
        unidad,
        unidadId: item.unidad?.id ?? "",
        loteCodigo,
        loteId,
        fincaNombre,
        notas: item.notas ?? null,
        costounit: costoLinea,
        subtotal: costoLinea === null ? null : redondear2(cantidadNum * costoLinea),
      };
    });

        let montoTotal: number | null = null;
    if (verCostos) {
      let acumulado = 0;
      let hayCosto = false;
      for (const p of productos) {
        if (p.subtotal === null) continue;
        hayCosto = true;
        acumulado += p.subtotal;
      }
      montoTotal = hayCosto ? redondear2(acumulado) : null;
    }

    return {
      id: doc.id,
      codigo: doc.consecutivo ?? doc.id,
      consecutivo: doc.consecutivo ?? undefined,
      tipo: doc.tipo as MovimientoTipo,
      estado: doc.estado as MovimientoEstado,
      fecha: doc.fecha ? doc.fecha.toISOString() : null,
      createdat: doc.createdat ? doc.createdat.toISOString() : undefined,

      bodegaOrigen: doc.bodega_documento_bodegaorigenidTobodega
        ? {
            id: doc.bodega_documento_bodegaorigenidTobodega.id,
            nombre: doc.bodega_documento_bodegaorigenidTobodega.nombre,
          }
        : null,
      bodegaDestino: doc.bodega_documento_bodegadestinoidTobodega
        ? {
            id: doc.bodega_documento_bodegadestinoidTobodega.id,
            nombre: doc.bodega_documento_bodegadestinoidTobodega.nombre,
          }
        : null,
      proveedor: doc.proveedor
        ? { id: doc.proveedor.id, nombre: doc.proveedor.nombre, nit: doc.proveedor.nit ?? null }
        : null,
      solicitante: doc.usuario_documento_solicitanteidTousuario
        ? {
            id: doc.usuario_documento_solicitanteidTousuario.id,
            nombre: doc.usuario_documento_solicitanteidTousuario.nombre,
          }
        : null,
      creador: doc.usuario_documento_creadoridTousuario
        ? {
            id: doc.usuario_documento_creadoridTousuario.id,
            nombre: doc.usuario_documento_creadoridTousuario.nombre,
          }
        : null,
      comprobante: doc.comprobante_fiscal
        ? {
            tipocomprobante: doc.comprobante_fiscal.tipocomprobante,
            numero: doc.comprobante_fiscal.numero,
            serie: doc.comprobante_fiscal.serie ?? null,
          }
        : null,
      observacion: doc.observacion ?? null,

      productos,
      totalProductos: productos.length,
      montoTotal,

      origen,
      destino,
    };
  },

  // ---------------------------------------
  // EXPORTS en PDF
  // ---------------------------------------
    async exportListadoMovimientosPDF(
    filtros: MovimientosFiltros = {},
    usuario?: UsuarioContexto
  ): Promise<{ filename: string; mime: string; content: Buffer }> {
    const where = buildWhereMovimientos(filtros, usuario);
    const verCostos = puedeVerCostos(usuario?.rol);

    const documentos = await prisma.documento.findMany({
      where,
      orderBy: [{ fecha: "desc" }, { createdat: "desc" }],
      take: 500,
      include: INCLUDE_RESUMEN,
    });

    const movimientos = documentos.map((d) => aResumen(d, verCostos));

    const buffer = await buildPDF((doc) => {
      doc.fontSize(16).text("Listado de movimientos", { align: "center" });
      doc.moveDown();
      doc.fontSize(10);
      movimientos.forEach((m) => {
        doc.font("Helvetica-Bold").text(`Documento: ${m.codigo}`, { continued: false });
        doc.font("Helvetica").text(`Tipo: ${m.tipo}   Estado: ${m.estado}`);
        doc.text(`Origen: ${m.origen ?? "-"}   Destino: ${m.destino ?? "-"}`);
        doc.text(`Proveedor: ${m.proveedor?.nombre ?? "-"}`);
        doc.text(`Productos: ${m.resumenProductos.join(", ") || m.productos}`);
        doc.text(`Fecha: ${m.fecha ?? "-"}`);
        if (verCostos) {
          doc.text(`Monto: ${m.montoTotal === null ? "-" : m.montoTotal.toFixed(2)}`);
        }
        doc.moveDown(0.8);
      });
    });
    return { filename: "movimientos.pdf", mime: "application/pdf", content: buffer };
  },

    async exportMovimientoDetallePDF(
    id: string,
    usuario?: UsuarioContexto
  ): Promise<{ filename: string; mime: string; content: Buffer }> {
    const det = await this.getDetalleMovimiento(id, usuario);
    const verCostos = puedeVerCostos(usuario?.rol);
    const buffer = await buildPDF((doc) => {
      doc.fontSize(16).text(`Documento ${det.codigo}`, { align: "center" });
      doc.moveDown();
      doc.fontSize(10);
            doc.text(`Tipo: ${det.tipo}`);
      doc.text(`Estado: ${det.estado}`);
      doc.text(`Fecha: ${det.fecha ?? "-"}`);
      doc.text(`Origen: ${det.origen ?? "-"}   Destino: ${det.destino ?? "-"}`);
      doc.text(`Proveedor: ${det.proveedor?.nombre ?? "-"}`);
      doc.moveDown();
      doc.fontSize(12).text("Productos", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      det.productos.forEach((p) => {
        doc.font("Helvetica-Bold").text(p.productoNombre);
        doc.font("Helvetica").text(`Código: ${p.productoCodigo}   Cantidad: ${p.cantidad}`);
        doc.text(`Lote: ${p.loteCodigo ?? "-"}   Finca: ${p.fincaNombre ?? "-"}`);
        if (verCostos && p.subtotal !== null) {
          doc.text(`Subtotal: ${p.subtotal.toFixed(2)}`);
        }
        doc.moveDown(0.6);
      });
      if (verCostos && det.montoTotal !== null) {
        doc.moveDown();
        doc.font("Helvetica-Bold").text(`Monto total: ${det.montoTotal.toFixed(2)}`);
      }
    });
    const safeCodigo = det.codigo.replace(/[^a-zA-Z0-9_-]/g, "_");
    return { filename: `documento_${safeCodigo}.pdf`, mime: "application/pdf", content: buffer };
  },
};