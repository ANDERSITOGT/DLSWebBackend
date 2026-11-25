// src/core/tiempo.ts
// =============================================================================
// Fuente ÚNICA de verdad para el manejo de fechas/horas del backend.
//
// Regla de negocio: todas las fechas se interpretan y formatean en
// America/Guatemala (UTC-6, sin horario de verano: el offset es constante
// todo el año, por lo que no hace falta la base de zonas IANA para convertir).
//
// Nada de este módulo toca schema.prisma: las columnas siguen siendo
// `timestamp(6)` sin zona horaria y Prisma las sigue manejando como `Date`
// (instantes UTC). Lo que se centraliza aquí es CÓMO se construyen y CÓMO se
// formatean esos instantes.
// =============================================================================

/** Zona horaria de negocio. */
export const TZ_NEGOCIO = "America/Guatemala";

/**
 * Offset fijo de Guatemala respecto a UTC, en milisegundos (UTC-6).
 * Es constante todo el año porque Guatemala no aplica horario de verano.
 */
export const OFFSET_GT_MS = 6 * 60 * 60 * 1000;

/** Milisegundos que tiene un día. */
export const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Formato "solo día" (`YYYY-MM-DD`). */
const SOLO_FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// -----------------------------------------------------------------------------
// Helpers internos
// -----------------------------------------------------------------------------

/**
 * Verifica que `YYYY-MM-DD` exista realmente en el calendario
 * (rechaza cosas como `2026-02-31`).
 */
function esFechaCalendarioValida(fecha: string): boolean {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    d.getUTCFullYear() === anio &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
}

/**
 * Acepta `Date`, ISO 8601, `YYYY-MM-DD` o cualquier cadena parseable por
 * `Date`. Devuelve `null` si no es representable.
 */
function aFechaUtil(input: string | Date | null | undefined): Date | null {
  if (input === null || input === undefined) return null;

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  const limpio = String(input).trim();
  if (limpio === "") return null;

  // Fecha solo-día: se maneja aparte (no usar `new Date(...)` directo).
  if (SOLO_FECHA_REGEX.test(limpio)) {
    if (!esFechaCalendarioValida(limpio)) return null;
    return new Date(`${limpio}T12:00:00.000Z`); // provisional, se ajusta abajo
  }

  const d = new Date(limpio);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Indica si el input es una fecha "solo día" (`YYYY-MM-DD`) válida. */
function esSoloFecha(input: string | Date | null | undefined): input is string {
  return typeof input === "string" && SOLO_FECHA_REGEX.test(input.trim());
}

// -----------------------------------------------------------------------------
// Conversión clave: día de negocio <-> instante UTC
// -----------------------------------------------------------------------------

/**
 * Clave de día de negocio (`YYYY-MM-DD`) de un instante.
 *
 * Equivale a "qué día es en Guatemala cuando en UTC son las `fecha`".
 * Ej.: `2026-03-01T06:00:00Z` -> `"2026-03-01"` (00:00 en GT).
 */
export function claveDiaGT(fecha: Date): string {
  return new Date(fecha.getTime() - OFFSET_GT_MS).toISOString().slice(0, 10);
}

/**
 * Inicio del día **en Guatemala** (`00:00:00.000` GT = `06:00:00.000Z`).
 *
 * - `"2026-03-01"` -> `2026-03-01T06:00:00.000Z`
 * - Un `Date` -> inicio del día GT al que pertenece ese instante.
 */
export function inicioDelDiaGT(fecha: string | Date): Date {
  const clave = typeof fecha === "string" && SOLO_FECHA_REGEX.test(fecha.trim())
    ? fecha.trim()
    : claveDiaGT(fecha as Date);

  if (!esFechaCalendarioValida(clave)) {
    // Fecha inválida: se devuelve el epoch como centinela predecible.
    return new Date(0);
  }

  // Medianoche UTC del día + 6h = medianoche GT expresada en UTC.
  const medianocheUTC = Date.parse(`${clave}T00:00:00.000Z`);
  return new Date(medianocheUTC + OFFSET_GT_MS);
}

/**
 * Último instante del día **en Guatemala**
 * (`23:59:59.999` GT = `05:59:59.999Z` del día siguiente).
 */
export function finDelDiaGT(fecha: string | Date): Date {
  const inicio = inicioDelDiaGT(fecha);
  return new Date(inicio.getTime() + MS_POR_DIA - 1);
}

/** Año en curso en Guatemala. */
export function anioActualGT(): number {
  return Number(claveDiaGT(new Date()).slice(0, 4));
}

/** Hora actual de Guatemala como `HH:mm:ss` (útil para combinar con un día). */
function horaActualGT(): string {
  const ahora = new Date();
  const gt = new Date(ahora.getTime() - OFFSET_GT_MS);
  return gt.toISOString().slice(11, 23); // HH:mm:ss.SSS
}

// -----------------------------------------------------------------------------
// Parseo de entradas del API
// -----------------------------------------------------------------------------

/**
 * Convierte una entrada de fecha del API a un `Date` seguro en hora Guatemala.
 *
 * Reglas:
 *  - `null`/`undefined`/`""` -> `new Date()` (instante actual).
 *  - **Fecha solo-día** (`YYYY-MM-DD`): NUNCA se interpreta como `00:00:00Z`
 *    (eso caería en el día anterior en GT). En su lugar:
 *      * `conservarHoraActual = true`  -> ese día **con la hora actual** de GT.
 *        Útil para documentos (ingreso, salida, solicitud) donde el usuario
 *        elige el día pero interesa el momento en que se registra.
 *      * `conservarHoraActual = false` -> ese día a **mediodía** de GT
 *        (`12:00:00-06:00` = `18:00:00.000Z`). Útil para fechas puras de
 *        calendario (siembra, cierre, cosecha): el punto medio del día es
 *        inmune a desfases de ±12h al agrupar por día.
 *  - ISO 8601 completo (`...T...Z`, `...-06:00`): se respeta tal cual.
 *  - Cualquier otra cadena parseable: se usa `new Date(...)`.
 *  - Entrada inválida -> `null` (el llamador decide el fallback).
 */
export function parsearFechaNegocio(
  input?: string | Date | null,
  conservarHoraActual = true
): Date {
  // Sin valor: instante actual.
  if (input === null || input === undefined || (typeof input === "string" && input.trim() === "")) {
    return new Date();
  }

  // Fecha solo-día válida: se combina con hora GT, nunca con 00:00Z.
  if (esSoloFecha(input)) {
    const dia = input.trim();
    if (!esFechaCalendarioValida(dia)) return new Date();

    const base = inicioDelDiaGT(dia); // 00:00 GT
    if (!conservarHoraActual) {
      return new Date(base.getTime() + 12 * 60 * 60 * 1000); // mediodía GT
    }

    // Día elegido + hora actual de Guatemala.
    const [hh, mm, ss] = horaActualGT().split(":");
    return new Date(
      base.getTime() +
        Number(hh) * 60 * 60 * 1000 +
        Number(mm) * 60 * 1000 +
        Math.floor(Number(ss) * 1000)
    );
  }

  const fecha = aFechaUtil(input);
  return fecha ?? new Date();
}

/**
 * Igual que `parsearFechaNegocio` pero devuelve `null` en lugar del instante
 * actual cuando la entrada es inválida. Útil para validaciones estrictas.
 */
export function parsearFechaNegocioOpcional(
  input?: string | Date | null,
  conservarHoraActual = true
): Date | null {
  if (input === null || input === undefined || (typeof input === "string" && input.trim() === "")) {
    return null;
  }

  if (esSoloFecha(input)) {
    const dia = input.trim();
    if (!esFechaCalendarioValida(dia)) return null;
    return parsearFechaNegocio(dia, conservarHoraActual);
  }

  return aFechaUtil(input);
}

// -----------------------------------------------------------------------------
// Formateo
// -----------------------------------------------------------------------------

const formateadorFechaGT = new Intl.DateTimeFormat("es-GT", {
  timeZone: TZ_NEGOCIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formateadorFechaHoraGT = new Intl.DateTimeFormat("es-GT", {
  timeZone: TZ_NEGOCIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Formatea solo la fecha de negocio: `"01/03/2026"` (es-GT, America/Guatemala).
 */
export function formatearFechaGT(fecha: Date): string {
  return formateadorFechaGT.format(fecha);
}

/**
 * Formatea fecha + hora de negocio: `"01/03/2026, 14:35"`.
 */
export function formatearFechaHoraGT(fecha: Date): string {
  return formateadorFechaHoraGT.format(fecha);
}
