// src/core/valuacion.ts
// =============================================================================
// Motor financiero compartido: valuación (CPP) y stock físico.
//
// Única fuente de verdad para:
//  - Normalización monetaria (redondeo, validación de precios).
//  - Cálculo del Costo Promedio Ponderado (CPP).
//  - Signos de stock por tipo de documento.
//  - Stock físico y comprometido (centralizado, sin N+1).
// =============================================================================
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  ESTADO_DOCUMENTO_APROBADO,
  TIPO_DOCUMENTO_AJUSTE,
  TIPO_DOCUMENTO_DEVOLUCION,
  TIPO_DOCUMENTO_INGRESO,
  TIPO_DOCUMENTO_SALIDA,
  TIPO_SOLICITUD_DESPACHO,
  SOLICITUD_APROBADA,
  SOLICITUD_PENDIENTE,
} from "./constants";

/** Cliente Prisma o cliente transaccional (`$transaction`). */
export type Db = PrismaClient | Prisma.TransactionClient;

// -----------------------------------------------------------------------------
// Precisión de columnas (deben reflejar schema.prisma)
// -----------------------------------------------------------------------------
/** `producto.precioref` -> Decimal(12,2) */
export const PRECIOREF_DECIMALES = 2;
export const PRECIOREF_MAX_ENTERO = 10 ** (12 - PRECIOREF_DECIMALES);

/** `documento_item.costounit` -> Decimal(12,4) */
export const COSTOUNIT_DECIMALES = 4;
export const COSTOUNIT_MAX_ENTERO = 10 ** (12 - COSTOUNIT_DECIMALES);

// -----------------------------------------------------------------------------
// Helpers numéricos
// -----------------------------------------------------------------------------
/** Redondea a `dec` decimales evitando artefactos de punto flotante. */
export function redondear(n: number, dec = 2): number {
  const f = 10 ** dec;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/**
 * Convierte a `number` aceptando "1,5" (coma decimal) además de "1.5".
 *
 * Prisma devuelve las columnas `Decimal` como objetos (`Prisma.Decimal`),
 * no como `number`; sin el caso de objeto cualquier importe leído de BD se
 * interpretaría como `null`.
 */
export function aNumero(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const limpio = value.trim().replace(",", ".");
    if (limpio === "") return null;
    const n = Number(limpio);
    return Number.isFinite(n) ? n : null;
  }
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

/** Recorta un string de query/body; devuelve `null` si queda vacío. */
export function textoOpcional(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const limpio = String(value).trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * Normaliza un importe a la precisión de `documento_item.costounit`
 * (`Decimal(12,4)`). Devuelve `null` si no es finito/positivo o si desborda
 * la columna.
 */
export function normalizarCosto(value: unknown): number | null {
  const n = aNumero(value);
  if (n === null || !Number.isFinite(n) || n <= 0) return null;
  const r = redondear(n, COSTOUNIT_DECIMALES);
  if (r >= COSTOUNIT_MAX_ENTERO) return null;
  return r;
}

/**
 * Normaliza un importe a la precisión de `producto.precioref`
 * (`Decimal(12,2)`). Devuelve `null` si no es finito/positivo.
 */
export function normalizarPrecioref(value: unknown): number | null {
  const n = aNumero(value);
  if (n === null || !Number.isFinite(n) || n <= 0) return null;
  const r = redondear(n, PRECIOREF_DECIMALES);
  if (r >= PRECIOREF_MAX_ENTERO) return null;
  return r;
}

// -----------------------------------------------------------------------------
// Costo Promedio Ponderado (CPP)
// -----------------------------------------------------------------------------
export type ResultadoCpp = {
  /** CPP resultante, redondeado a `Decimal(12,2)`. `null` si no aplica. */
  cppNuevo: number | null;
  stockPrevio: number;
  cppActual: number | null;
  /** Valor del inventario previo (`stockPrevio * cppActual`). */
  valorPrevio: number;
  /** Valor de la entrada (`cantidadIngreso * costounit`). */
  valorEntrada: number;
};

/**
 * Calcula el Costo Promedio Ponderado tras una entrada.
 *
 * Fórmula:
 *   cppNuevo = ((stockPrevio * cppActual) + (cantidadIngreso * costounit))
 *              / (stockPrevio + cantidadIngreso)
 *
 * Reglas:
 *  - Si `stockPrevio > 0` y `cppActual > 0` -> ponderación.
 *  - Si `stockPrevio <= 0` o `cppActual` es null/0 (stock no valorado o
 *    negativo) -> `cppNuevo = costounit` (arranque del promedio).
 *  - Si `costounit <= 0` (bonificación / muestra) -> `cppNuevo = null` y el
 *    llamador NO debe tocar el `precioref` vigente (evita diluir el costo).
 *  - Si `cantidadIngreso <= 0` -> `cppNuevo = cppActual` (sin efecto).
 *
 * El resultado se redondea a 2 decimales (`Decimal(12,2)`).
 */
export function calcularCpp(input: {
  stockPrevio: number;
  cppActual: number | null | undefined;
  cantidadIngreso: number;
  costounit: number | null | undefined;
}): ResultadoCpp {
  const stockPrevio = Number.isFinite(input.stockPrevio) ? input.stockPrevio : 0;
  const cppActualNum = aNumero(input.cppActual);
  const cppActual = cppActualNum !== null && cppActualNum > 0 ? cppActualNum : null;
  const cantidad = aNumero(input.cantidadIngreso) ?? 0;
  const costo = aNumero(input.costounit);

  const valorPrevio = cppActual === null ? 0 : redondear(stockPrevio * cppActual, 4);
  const valorEntrada = costo === null || costo <= 0 ? 0 : redondear(cantidad * costo, 4);

  // Sin costo válido: no se pondera ni se sobrescribe el `precioref` vigente.
  if (costo === null || costo <= 0) {
    return { cppNuevo: null, stockPrevio, cppActual, valorPrevio, valorEntrada };
  }

  // Entrada sin cantidad: no altera el promedio.
  if (cantidad <= 0) {
    return {
      cppNuevo: cppActual === null ? null : redondear(cppActual, PRECIOREF_DECIMALES),
      stockPrevio,
      cppActual,
      valorPrevio,
      valorEntrada,
    };
  }

  let cppNuevo: number;
  if (stockPrevio > 0 && cppActual !== null) {
    cppNuevo = (valorPrevio + valorEntrada) / (stockPrevio + cantidad);
  } else {
    // Stock previo agotado, negativo o no valorado: se arranca con el costo real.
    cppNuevo = costo;
  }

  return {
    cppNuevo: redondear(cppNuevo, PRECIOREF_DECIMALES),
    stockPrevio,
    cppActual,
    valorPrevio,
    valorEntrada,
  };
}

// -----------------------------------------------------------------------------
// Signos de stock por tipo de documento
// -----------------------------------------------------------------------------
/** Documento mínimo necesario para derivar el signo. */
export type DocumentoParaSigno = {
  tipo: string;
  proveedorid?: string | null;
};

/**
 * Signo que aplica una línea al stock físico global.
 *
 * - `INGRESO`     : +1
 * - `SALIDA`      : -1
 * - `AJUSTE`      : se toma la `cantidad` tal cual (ya viene con signo:
 *                   negativa para merma/faltante, positiva para sobrante).
 *                   Por eso el signo base es +1 sobre la cantidad firmada.
 * - `DEVOLUCION`  : -1 si es a proveedor (tiene `proveedorid`), +1 si es
 *                   interna (sin proveedor).
 * - Otros (`TRANSFERENCIA`): 0 (no altera el stock global).
 */
export function signoStock(doc: DocumentoParaSigno): number {
  if (doc.tipo === TIPO_DOCUMENTO_INGRESO) return 1;
  if (doc.tipo === TIPO_DOCUMENTO_SALIDA) return -1;
  if (doc.tipo === TIPO_DOCUMENTO_AJUSTE) return 1;
  if (doc.tipo === TIPO_DOCUMENTO_DEVOLUCION) return doc.proveedorid ? -1 : 1;
  return 0;
}

/**
 * Igual que `signoStock`, pero a partir de `tipo` + `proveedorid` sueltos.
 * Útil en kardex y listados donde ya se tiene el documento desnormalizado.
 */
export function tipoDocumentoSuma(tipo: string, proveedorid: string | null): number {
  return signoStock({ tipo, proveedorid });
}

// -----------------------------------------------------------------------------
// Stock físico y comprometido
// -----------------------------------------------------------------------------
export type StockPorProducto = {
  /** Stock físico (todos los movimientos aprobados, con signo). */
  fisico: number;
  /** Cantidad comprometida por solicitudes DESPACHO PENDIENTE/APROBADA. */
  comprometido: number;
  /** `fisico - comprometido`. */
  disponible: number;
};

/**
 * Stock físico de un producto (o de varios) en una sola pasada.
 *
 * Usa `groupBy` para que sea O(1) consultas independientemente del número de
 * productos, eliminando el patrón N+1.
 *
 * @param db       Cliente Prisma o transaccional.
 * @param ids      Uno o varios `producto.id`.
 * @param opciones.stockPrevioA  Si se indica, sólo considera documentos con
 *                               `fecha` estrictamente anterior. Útil para CPP.
 */
export async function stockFisicoPorProducto(
  db: Db,
  ids: string[],
  opciones?: { stockPrevioA?: Date }
): Promise<Record<string, number>> {
  const desglose = await stockFisicoDetallado(db, ids, opciones);
  const resultado: Record<string, number> = {};
  for (const [id, d] of Object.entries(desglose)) resultado[id] = d.fisico;
  return resultado;
}

export type DesgloseStock = {
  ingresos: number;
  salidas: number;
  ajustes: number;
  devolucionesInternas: number;
  devolucionesProveedor: number;
  /** ingresos + ajustes + devIn - salidas - devOut */
  fisico: number;
};

/**
 * Desglose de stock por categoría de movimiento para varios productos.
 * Una sola consulta (`groupBy` por producto + tipo) sin importar cuántos ids.
 */
export async function stockFisicoDetallado(
  db: Db,
  ids: string[],
  opciones?: { stockPrevioA?: Date }
): Promise<Record<string, DesgloseStock>> {
  const resultado: Record<string, DesgloseStock> = {};
  if (ids.length === 0) return resultado;

  for (const id of ids) {
    resultado[id] = {
      ingresos: 0,
      salidas: 0,
      ajustes: 0,
      devolucionesInternas: 0,
      devolucionesProveedor: 0,
      fisico: 0,
    };
  }

  const whereFecha = opciones?.stockPrevioA
    ? { fecha: { lt: opciones.stockPrevioA } }
    : {};

  // Una sola consulta: tipo + proveedorid + productoid.
  const filas = await db.documento_item.groupBy({
    by: ["productoid", "documentoid"],
    where: {
      productoid: { in: ids },
      documento: { estado: ESTADO_DOCUMENTO_APROBADO, ...whereFecha },
    },
    _sum: { cantidad: true },
  });

  if (filas.length === 0) return resultado;

  // Se necesita el tipo/proveedor de cada documento: una única consulta.
  const docIds = [...new Set(filas.map((f) => f.documentoid))];
  const documentos = await db.documento.findMany({
    where: { id: { in: docIds } },
    select: { id: true, tipo: true, proveedorid: true },
  });
  const docMap = new Map(documentos.map((d) => [d.id, d]));

  for (const fila of filas) {
    const doc = docMap.get(fila.documentoid);
    if (!doc) continue;
    const cantidad = aNumero(fila._sum.cantidad) ?? 0;
    const acc = resultado[fila.productoid];
    if (!acc) continue;

    if (doc.tipo === TIPO_DOCUMENTO_INGRESO) acc.ingresos += cantidad;
    else if (doc.tipo === TIPO_DOCUMENTO_SALIDA) acc.salidas += cantidad;
    else if (doc.tipo === TIPO_DOCUMENTO_AJUSTE) acc.ajustes += cantidad;
    else if (doc.tipo === TIPO_DOCUMENTO_DEVOLUCION) {
      if (doc.proveedorid) acc.devolucionesProveedor += cantidad;
      else acc.devolucionesInternas += cantidad;
    }
  }

  for (const acc of Object.values(resultado)) {
    acc.fisico = redondear(
      acc.ingresos + acc.ajustes + acc.devolucionesInternas
        - acc.salidas - acc.devolucionesProveedor,
      4
    );
  }

  return resultado;
}

/**
 * Stock comprometido (= reservado) por solicitudes DESPACHO aún no entregadas.
 *
 * Regla: sólo las solicitudes de tipo **DESPACHO** en estado PENDIENTE o
 * APROBADA comprometen stock. Las DEVOLUCION pendientes NO reservan stock de
 * salida (bug histórico que inflaba el comprometido).
 */
export async function stockComprometidoPorProducto(
  db: Db,
  ids: string[]
): Promise<Record<string, number>> {
  const resultado: Record<string, number> = {};
  if (ids.length === 0) return resultado;

  const filas = await db.solicitud_item.groupBy({
    by: ["productoid"],
    where: {
      productoid: { in: ids },
      solicitud: {
        estado: { in: [SOLICITUD_PENDIENTE, SOLICITUD_APROBADA] },
        tipo: TIPO_SOLICITUD_DESPACHO,
      },
    },
    _sum: { cantidad: true },
  });

  for (const id of ids) resultado[id] = 0;
  for (const f of filas) {
    resultado[f.productoid] = redondear(aNumero(f._sum.cantidad) ?? 0, 4);
  }
  return resultado;
}

/**
 * Stock físico + comprometido + disponible para un conjunto de productos.
 * Dos consultas en total, sin importar cuántos productos.
 */
export async function stockResumenPorProducto(
  db: Db,
  ids: string[]
): Promise<Record<string, StockPorProducto>> {
  const resultado: Record<string, StockPorProducto> = {};
  const lista = [...new Set(ids)];
  if (lista.length === 0) return resultado;

  const [fisico, comprometido] = await Promise.all([
    stockFisicoPorProducto(db, lista),
    stockComprometidoPorProducto(db, lista),
  ]);

  for (const id of lista) {
    const f = redondear(fisico[id] ?? 0, 4);
    const c = redondear(comprometido[id] ?? 0, 4);
    resultado[id] = { fisico: f, comprometido: c, disponible: redondear(f - c, 4) };
  }
  return resultado;
}
