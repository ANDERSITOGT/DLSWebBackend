import type { PrismaClient } from "@prisma/client";

// =============================================================================
// Tipos del contrato (§4.1 API_BACKEND.md)
// =============================================================================
export type ComprobanteOcrDTO = {
  tipocomprobante: string | null;
  numero: string | null;
  serie: string | null;
  uuid: string | null;
  fechaemision: string | null;
  nit: string | null;
};

export type ProveedorOcrDTO = {
  id: string | null;
  nit: string | null;
  nombre: string | null;
  coincidenciaNit: boolean;
};

export type CandidatoProductoOcrDTO = {
  id: string;
  nombre: string;
  codigo: string;
  precioref: number | null;
};

export type ItemOcrDTO = {
  productoid: string | null;
  productocodigo: string | null;
  descripcion: string;
  cantidad: number | null;
  costounit: number | null;
  unidad: string | null;
  nivelConfianza: number;
  requiereRevision: boolean;
  candidatos: CandidatoProductoOcrDTO[];
};

export type EscaneoOcrDTO = {
  confianza: number;
  motor: string;
  textoCrudo: string;
  comprobante: ComprobanteOcrDTO;
  proveedor: ProveedorOcrDTO | null;
  items: ItemOcrDTO[];
  advertencias: string[];
  requiereRevisionManual: boolean;
};

// =============================================================================
// Configuración
// =============================================================================
export const MOTOR_OCR = "tesseract.js";
const IDIOMAS = "spa+eng";
/** Confianza global mínima (0..1) para no exigir revisión manual. */
const UMBRAL_CONFIANZA_GLOBAL = 0.6;
/** Confianza mínima por línea. */
const UMBRAL_CONFIANZA_LINEA = 0.75;
/** Similitud mínima (0..1) para aceptar un match difuso de nombre. */
const UMBRAL_SIMILITUD_PROVEEDOR = 0.72;
const UMBRAL_SIMILITUD_PRODUCTO = 0.62;
const MAX_CANDIDATOS = 3;

// =============================================================================
// Helpers de texto
// =============================================================================
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Palabras ignoradas al comparar nombres de producto/proveedor. */
const STOPWORDS = new Set([
  "DE", "DEL", "LA", "EL", "LOS", "LAS", "Y", "PARA", "CON", "POR", "EN", "A",
  "X", "S", "SA", "S.A", "LTDA", "SOCIEDAD", "ANONIMA", "COMPAÑIA", "COMPANIA",
  "CIA", "SUCURSAL", "SUC", "GRANEL", "UNIDAD", "UND", "CAJA", "BOLSA",
]);

function tokenizar(texto: string): string[] {
  return normalizar(texto)
    .replace(/[^A-Z0-9ÁÉÍÓÚÑÜ ]/g, " ")
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Coeficiente de Dice sobre bigramas: 0 (nada) .. 1 (idéntico). Robusto ante OCR. */
function similitud(a: string, b: string): number {
  const x = normalizar(a).replace(/[^A-Z0-9 ]/g, "");
  const y = normalizar(b).replace(/[^A-Z0-9 ]/g, "");
  if (!x || !y) return 0;
  if (x === y) return 1;

  const bigramas = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };

  const bx = bigramas(x);
  const by = bigramas(y);
  let interseccion = 0;
  let totalX = 0;
  let totalY = 0;

  for (const c of bx.values()) totalX += c;
  for (const c of by.values()) totalY += c;
  for (const [g, c] of bx) {
    const otro = by.get(g);
    if (otro) interseccion += Math.min(c, otro);
  }

  return (2 * interseccion) / (totalX + totalY);
}

/** Similitud por palabras clave: proporción de tokens del candidato presentes en el texto. */
function similitudTokens(textoFuente: string, nombreCandidato: string): number {
  const fuente = new Set(tokenizar(textoFuente));
  const objetivo = tokenizar(nombreCandidato);
  if (objetivo.length === 0 || fuente.size === 0) return 0;

  let encontrados = 0;
  for (const t of objetivo) {
    if (fuente.has(t)) encontrados++;
    // tolerancia a errores OCR de 1 caracter
    else if ([...fuente].some((f) => f.length > 3 && Math.abs(f.length - t.length) <= 1 && similitud(f, t) > 0.8)) {
      encontrados += 1;
    }
  }
  return encontrados / objetivo.length;
}

function aNumero(value: string | null | undefined): number | null {
  if (!value) return null;
  const limpio = value.replace(/[^\d.,-]/g, "").trim();
  if (!limpio) return null;

  // Formato GT: 1,234.56 (miles con coma, decimales con punto) o 1.234,56
  let normalizado: string;
  if (limpio.includes(",") && limpio.includes(".")) {
    const ultimaComa = limpio.lastIndexOf(",");
    const ultimoPunto = limpio.lastIndexOf(".");
    normalizado =
      ultimaComa > ultimoPunto
        ? limpio.replace(/\./g, "").replace(",", ".")
        : limpio.replace(/,/g, "");
  } else if (limpio.includes(",")) {
    const partes = limpio.split(",");
    normalizado = partes.length === 2 && partes[1].length <= 2
      ? `${partes[0]}.${partes[1]}`
      : limpio.replace(/,/g, "");
  } else {
    normalizado = limpio;
  }

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

function redondear(n: number, decimales = 4): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

// =============================================================================
// OCR: extracción de texto crudo
// =============================================================================
export type ResultadoExtraccion = {
  textoCrudo: string;
  confianza: number;
};

/**
 * Ejecuta tesseract.js (spa+eng) sobre un buffer de imagen en memoria.
 * Usa reconocimiento one-shot (sin worker persistente) para no retener
 * recursos entre requests; la primera llamada descarga/compila el modelo.
 */
export async function extraerTexto(imagen: Buffer): Promise<ResultadoExtraccion> {
  const { recognize } = await import("tesseract.js");

  const { data } = await recognize(imagen, IDIOMAS, {
    logger: () => {
      /* silencioso: evitar ruido en logs de producción */
    },
  } as Parameters<typeof recognize>[2]);

  const textoCrudo = (data?.text ?? "").replace(/\r/g, "").trim();
  const confianzaRaw = Number(data?.confidence ?? 0);

  return {
    textoCrudo,
    // tesseract devuelve 0..100
    confianza: redondear(Math.max(0, Math.min(1, confianzaRaw / 100)), 4),
  };
}

// =============================================================================
// Parser de comprobante
// =============================================================================
const UUID_FEL_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const NIT_REGEX = /\b(\d{2,12})\s*-?\s*(\d?)\b/g;

export function parsearComprobante(textoCrudo: string): ComprobanteOcrDTO {
  const lineas = textoCrudo.split("\n").map((l) => l.trim());
  const texto = textoCrudo;

  // --- tipo de comprobante ---
  let tipocomprobante: string | null = null;
  const t = normalizar(texto);
  if (/\bFACTURA\b/.test(t)) tipocomprobante = "FACTURA";
  else if (/\bRECIBO\b/.test(t)) tipocomprobante = "RECIBO";
  else if (/\bNOTA DE (CREDITO|DEBITO)\b/.test(t)) {
    tipocomprobante = /NOTA DE CREDITO/.test(t) ? "NOTA DE CREDITO" : "NOTA DE DEBITO";
  }

  // --- uuid FEL ---
  const uuidMatch = texto.match(UUID_FEL_REGEX);
  const uuid = uuidMatch ? uuidMatch[0].toUpperCase() : null;

  // --- número y serie ---
  let numero: string | null = null;
  let serie: string | null = null;

  // Patrones: "FACTURA No. 12345", "No. FACTURA: A-123", "FEL No 1234567"
  const patronesNumero = [
    /(?:FACTURA|FEL|RECIBO|DOCUMENTO|DPI)?\s*(?:NO\.?|NUMERO|NUM\.?|#)\s*[:.]?\s*([A-Z]{0,3}[-]?\d{1,15})/i,
    /\b([A-Z]{1,3}-\d{3,15})\b/i,
    /\bSERIE\s*[:.]?\s*([A-Z]{1,3})\b/i,
  ];

  for (const linea of lineas) {
    for (const patron of patronesNumero) {
      const m = linea.match(patron);
      if (m && m[1]) {
        const valor = m[1].toUpperCase();
        if (/^[A-Z]{1,3}-\d{1,5}$/.test(valor) && !serie) {
          serie = valor.split("-")[0];
          numero = valor.split("-")[1];
        } else if (!numero) {
          numero = valor;
        }
        break;
      }
    }
    if (numero && serie) break;
  }

  // Serie explícita
  const serieExplicita = texto.match(/SERIE\s*[:.]?\s*([A-Z0-9]{1,6})\b/i);
  if (serieExplicita) serie = serieExplicita[1].toUpperCase();

  // --- fecha de emisión (normalizada YYYY-MM-DD) ---
  let fechaemision: string | null = null;
  const fechaConEtiqueta = texto.match(
    /FECHA(?:\s+DE\s+EMISION)?\s*[:.]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i
  );
  const fechaSuelta = texto.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/);
  const fechaRaw = fechaConEtiqueta?.[1] ?? fechaSuelta?.[1] ?? null;
  if (fechaRaw) fechaemision = normalizarFecha(fechaRaw);

  // --- NIT del emisor ---
  // Se busca primero junto a una etiqueta NIT, luego el primer NIT con guion.
  let nit: string | null = null;
  const nitEtiquetado = texto.match(/NIT\s*[:.]?\s*([0-9]{2,12}\s*-?\s*[0-9Kk]?)/i);
  if (nitEtiquetado) {
    nit = nitEtiquetado[1].replace(/\s+/g, "");
  } else {
    const candidatos = [...texto.matchAll(NIT_REGEX)];
    const conFormato = candidatos.find((m) => m[2] !== undefined);
    if (conFormato) nit = `${conFormato[1]}-${conFormato[2]}`;
  }
  if (nit) nit = nit.toUpperCase();

  return { tipocomprobante, numero, serie, uuid, fechaemision, nit };
}

/** Normaliza dd/mm/yyyy, dd-mm-yy o yyyy-mm-dd a "YYYY-MM-DD". */
export function normalizarFecha(raw: string): string | null {
  const limpio = raw.trim();

  const iso = limpio.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = limpio.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    let anio = Number(dmy[3]);
    if (anio < 100) anio += anio <= 50 ? 2000 : 1900;
    const dia = Number(dmy[1]);
    const mes = Number(dmy[2]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }

  return null;
}

/** NIT comparable: solo dígitos. */
export function normalizarNit(nit: string | null | undefined): string {
  if (!nit) return "";
  return nit.replace(/[^0-9]/g, "");
}

// =============================================================================
// Parser de ítems
// =============================================================================
export type LineaParseada = {
  descripcion: string;
  productocodigo: string | null;
  cantidad: number | null;
  costounit: number | null;
  unidad: string | null;
};

const UNIDADES_PATRON = /\b(L|LT|LTS|LITRO|LITROS|ML|KG|KGS|KILO|KILOS|QQ|QUINTAL|QUINTALES|LB|LBS|LIBRA|LIBRAS|G|GR|GRAMO|GRAMOS|CC|M|MTS|METRO|METROS|U|UN|UND|UNIDAD|UNIDADES|BOLSA|BOLSAS|CAJA|CAJAS|GAL|GALON|GALONES|SACO|SACOS|FCO|FRASCO|SOBRE|SOBRES)\b/i;

const PATRONES_ITEM: RegExp[] = [
  // CANTIDAD  CODIGO  DESCRIPCION  COSTO
  /^\s*(\d{1,6}(?:[.,]\d{1,3})?)\s+([A-Z0-9][A-Z0-9._-]{1,20})\s+(.{3,}?)\s+([0-9][0-9.,]*)\s*$/,
  // CANTIDAD  DESCRIPCION  COSTO
  /^\s*(\d{1,6}(?:[.,]\d{1,3})?)\s+(.{3,}?)\s+([0-9][0-9.,]*)\s*$/,
  // DESCRIPCION  CANTIDAD  COSTO  TOTAL
  /^\s*(.{6,}?)\s+(\d{1,6}(?:[.,]\d{1,3})?)\s+([0-9][0-9.,]*)\s+([0-9][0-9.,]*)\s*$/,
];

const LINEAS_IGNORADAS =
  /^(SUBTOTAL|TOTAL|IVA|IMPUESTO|DESCUENTO|GRAN TOTAL|TOTAL A PAGAR|EFECTIVO|CAMBIO|VUELTO|NIT|FECHA|SERIE|FACTURA|CLIENTE|DIRECCION|TELEFONO|TEL|EMAIL|CANTIDAD|PRECIO|CODIGO|DESCRIPCION|UNITARIO|IMPORTE|PAGINA|RESOLUCION|AUTORIZACION)/i;

export function parsearItems(textoCrudo: string): LineaParseada[] {
  const lineas = textoCrudo.split("\n");
  const resultado: LineaParseada[] = [];

  // Detecta si la última columna es un total (para derivar costo unitario)
  const esFilaConTotal = (l: string) => PATRONES_ITEM[2].test(l) && !PATRONES_ITEM[1].test(l);

  for (const linea of lineas) {
    const limpia = linea.replace(/\s+/g, " ").trim();
    if (limpia.length < 6) continue;
    if (LINEAS_IGNORADAS.test(limpia)) continue;
    // Una línea de ítem debe contener al menos una cantidad y un importe numérico
    if (!/\d/.test(limpia)) continue;

    let descripcion = "";
    let productocodigo: string | null = null;
    let cantidad: number | null = null;
    let costo: number | null = null;

    // 1) CANTIDAD CODIGO DESCRIPCION COSTO
    const m1 = limpia.match(PATRONES_ITEM[0]);
    if (m1) {
      cantidad = aNumero(m1[1]);
      productocodigo = m1[2].toUpperCase();
      descripcion = m1[3].trim();
      costo = aNumero(m1[4]);
    } else {
      const m3 = limpia.match(PATRONES_ITEM[2]);
      const m2 = limpia.match(PATRONES_ITEM[1]);

      if (m3 && esFilaConTotal(limpia)) {
        // DESCRIPCION CANTIDAD COSTO TOTAL
        descripcion = m3[1].trim();
        cantidad = aNumero(m3[2]);
        const costoUnit = aNumero(m3[3]);
        const totalLinea = aNumero(m3[4]);
        costo = costoUnit;
        if (costo === null && totalLinea !== null && cantidad) {
          costo = redondear(totalLinea / cantidad, 4);
        }
      } else if (m2) {
        // CANTIDAD DESCRIPCION COSTO
        cantidad = aNumero(m2[1]);
        descripcion = m2[2].trim();
        costo = aNumero(m2[3]);
      }
    }

    if (!descripcion || descripcion.length < 3) continue;
    if (cantidad === null && costo === null) continue;
    // Descarta líneas de cabecera de tabla y totales sueltos
    if (descripcion.split(" ").every((p) => /^[^A-Za-zÁÉÍÓÚÑÜ]+$/.test(p) === false && p.length <= 2)) continue;

    // Unidad detectada dentro de la descripción
    let unidad: string | null = null;
    const unidadMatch = descripcion.match(UNIDADES_PATRON);
    if (unidadMatch) unidad = unidadMatch[1].toUpperCase();

    // Código embebido tipo "ABC-123" al inicio de la descripción
    if (!productocodigo) {
      const codigoEmbedido = descripcion.match(/^([A-Z]{1,4}-?\d{2,8})\b/i);
      if (codigoEmbedido) productocodigo = codigoEmbedido[1].toUpperCase();
    }

    resultado.push({
      descripcion: descripcion.replace(/\s{2,}/g, " ").trim(),
      productocodigo,
      cantidad,
      costounit: costo === null ? null : redondear(costo, 4),
      unidad,
    });

    if (resultado.length >= 200) break;
  }

  return resultado;
}

// =============================================================================
// Match de proveedor
// =============================================================================
type ProveedorDb = { id: string; nombre: string; nit: string | null };

export async function resolverProveedor(
  prisma: PrismaClient,
  opciones: { proveedorId?: string | null; nitDetectado: string | null; textoCrudo: string }
): Promise<{ proveedor: ProveedorOcrDTO | null; advertencias: string[] }> {
  const advertencias: string[] = [];
  const nitDetectado = opciones.nitDetectado;
  const nitNormalizado = normalizarNit(nitDetectado);

  const proveedores = (await prisma.proveedor.findMany({
    select: { id: true, nombre: true, nit: true },
  })) as ProveedorDb[];

  // 1) Match explícito por proveedorId enviado en el FormData
  if (opciones.proveedorId) {
    const porId = proveedores.find((p) => p.id === opciones.proveedorId);
    if (!porId) {
      advertencias.push("El proveedorId enviado no existe en la base de datos.");
      return { proveedor: null, advertencias };
    }

    const coincidenciaNit =
      nitNormalizado.length > 0 && normalizarNit(porId.nit) === nitNormalizado;

    if (nitNormalizado && !coincidenciaNit) {
      advertencias.push(
        "El NIT detectado en el documento no coincide con el proveedor seleccionado."
      );
    }

    return {
      proveedor: {
        id: porId.id,
        nit: nitDetectado ?? porId.nit,
        nombre: porId.nombre,
        coincidenciaNit,
      },
      advertencias,
    };
  }

  // 2) Match por NIT normalizado (sin guiones)
  if (nitNormalizado) {
    const porNit = proveedores.find((p) => normalizarNit(p.nit) === nitNormalizado);
    if (porNit) {
      return {
        proveedor: {
          id: porNit.id,
          nit: nitDetectado ?? porNit.nit,
          nombre: porNit.nombre,
          coincidenciaNit: true,
        },
        advertencias,
      };
    }
  }

  // 3) Match difuso por nombre en el encabezado del documento
  const encabezado = opciones.textoCrudo.split("\n").slice(0, 18).join("\n");
  let mejor: { proveedor: ProveedorDb; score: number } | null = null;

  for (const p of proveedores) {
    const scoreCompleto = similitud(encabezado, p.nombre);
    const scoreTokens = similitudTokens(encabezado, p.nombre);
    const score = Math.max(scoreCompleto * 0.9, scoreTokens);

    if (!mejor || score > mejor.score) mejor = { proveedor: p, score };
  }

  if (mejor && mejor.score >= UMBRAL_SIMILITUD_PROVEEDOR) {
    advertencias.push(
      `Proveedor identificado por nombre (${Math.round(mejor.score * 100)}% de similitud). Verifique el NIT.`
    );
    return {
      proveedor: {
        id: mejor.proveedor.id,
        nit: nitDetectado ?? mejor.proveedor.nit,
        nombre: mejor.proveedor.nombre,
        coincidenciaNit:
          nitNormalizado.length > 0 &&
          normalizarNit(mejor.proveedor.nit) === nitNormalizado,
      },
      advertencias,
    };
  }

  if (!nitDetectado && !mejor) {
    advertencias.push("No se pudo identificar al proveedor en el documento.");
  } else if (nitDetectado) {
    advertencias.push("El NIT detectado no coincide con ningún proveedor registrado.");
  }

  return {
    proveedor: nitDetectado
      ? { id: null, nit: nitDetectado, nombre: null, coincidenciaNit: false }
      : null,
    advertencias,
  };
}

// =============================================================================
// Match de ítems contra el catálogo
// =============================================================================
type ProductoDb = {
  id: string;
  codigo: string;
  nombre: string;
  ingredienteactivo: string | null;
  precioref: unknown;
  unidad: { abreviatura: string } | null;
};

export function construirIndiceProductos(productos: ProductoDb[]) {
  const porCodigo = new Map<string, ProductoDb>();
  for (const p of productos) {
    porCodigo.set(normalizar(p.codigo), p);
    porCodigo.set(p.codigo.replace(/[^A-Za-z0-9]/g, "").toUpperCase(), p);
  }
  return { productos, porCodigo };
}

function aCandidato(p: ProductoDb): CandidatoProductoOcrDTO {
  return {
    id: p.id,
    nombre: p.nombre,
    codigo: p.codigo,
    precioref: p.precioref === null || p.precioref === undefined ? null : Number(p.precioref),
  };
}

export function mapearItem(
  linea: LineaParseada,
  indice: ReturnType<typeof construirIndiceProductos>,
  confianzaGlobal: number
): ItemOcrDTO {
  const { productos, porCodigo } = indice;

  let matchExacto: ProductoDb | null = null;

  // 1) Código exacto (con o sin guiones)
  if (linea.productocodigo) {
    const key = linea.productocodigo.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    matchExacto = porCodigo.get(key) ?? porCodigo.get(normalizar(linea.productocodigo)) ?? null;
  }

  // 2) Código embebido dentro de la descripción
  if (!matchExacto) {
    for (const token of tokenizar(linea.descripcion)) {
      const porToken = porCodigo.get(token);
      if (porToken) {
        matchExacto = porToken;
        break;
      }
    }
  }

  // 3) Similitud de nombre / ingrediente activo
  const ranking = productos
    .map((p) => {
      const sNombre = Math.max(
        similitud(linea.descripcion, p.nombre),
        similitudTokens(linea.descripcion, p.nombre)
      );
      const sIngrediente = p.ingredienteactivo
        ? Math.max(
            similitud(linea.descripcion, p.ingredienteactivo),
            similitudTokens(linea.descripcion, p.ingredienteactivo)
          )
        : 0;
      return { producto: p, score: Math.max(sNombre, sIngrediente * 0.95) };
    })
    .filter((r) => r.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATOS);

  const productoFinal = matchExacto ?? (ranking[0] && ranking[0].score >= UMBRAL_SIMILITUD_PRODUCTO ? ranking[0].producto : null);

  const candidatos: CandidatoProductoOcrDTO[] = [];
  const vistos = new Set<string>();
  if (matchExacto) {
    candidatos.push(aCandidato(matchExacto));
    vistos.add(matchExacto.id);
  }
  for (const r of ranking) {
    if (candidatos.length >= MAX_CANDIDATOS) break;
    if (vistos.has(r.producto.id)) continue;
    candidatos.push(aCandidato(r.producto));
    vistos.add(r.producto.id);
  }

  // Nivel de confianza de la línea
  let nivelConfianza = confianzaGlobal;
  if (matchExacto) {
    nivelConfianza = Math.max(nivelConfianza, 0.97);
  } else if (productoFinal && ranking[0]) {
    nivelConfianza = redondear(
      Math.min(0.94, confianzaGlobal * 0.6 + ranking[0].score * 0.4),
      4
    );
  } else {
    nivelConfianza = redondear(Math.min(confianzaGlobal, 0.45), 4);
  }

  const tieneDatosMinimos = linea.cantidad !== null && linea.cantidad > 0 && linea.costounit !== null;
  const requiereRevision =
    !matchExacto ||
    nivelConfianza < UMBRAL_CONFIANZA_LINEA ||
    !tieneDatosMinimos ||
    !productoFinal;

  return {
    productoid: productoFinal?.id ?? null,
    productocodigo: linea.productocodigo ?? productoFinal?.codigo ?? null,
    descripcion: linea.descripcion,
    cantidad: linea.cantidad,
    costounit: linea.costounit,
    unidad: linea.unidad ?? productoFinal?.unidad?.abreviatura ?? null,
    nivelConfianza: redondear(nivelConfianza, 4),
    requiereRevision,
    candidatos,
  };
}

// =============================================================================
// Orquestador
// =============================================================================
const UMBRAL_TEXTO_MINIMO = 12;

export type EntradaEscaneo = {
  textoCrudo: string;
  confianza: number;
  proveedorId?: string | null;
};

export type SalidaEscaneo =
  | { tipo: "ok"; escaneo: EscaneoOcrDTO }
  | { tipo: "sin_texto"; textoCrudo: string; confianza: number };

/**
 * Convierte el texto crudo del OCR en el DTO del contrato §4.1,
 * cruzando proveedor e ítems contra la base de datos.
 */
export async function interpretarEscaneo(
  prisma: PrismaClient,
  entrada: EntradaEscaneo
): Promise<SalidaEscaneo> {
  const textoCrudo = entrada.textoCrudo;
  const sinTextoUtil =
    textoCrudo.replace(/[^A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü]/g, "").length < UMBRAL_TEXTO_MINIMO;

  if (sinTextoUtil) {
    return { tipo: "sin_texto", textoCrudo, confianza: entrada.confianza };
  }

  const advertencias: string[] = [];

  const comprobante = parsearComprobante(textoCrudo);
  if (!comprobante.numero) advertencias.push("No se pudo leer el número de comprobante.");
  if (!comprobante.fechaemision) advertencias.push("No se pudo leer la fecha de emisión.");
  if (!comprobante.nit) advertencias.push("No se pudo leer el NIT del emisor (NIT).");
  if (!comprobante.uuid) advertencias.push("No se detectó UUID de factura electrónica (FEL).");

  const { proveedor, advertencias: advProveedor } = await resolverProveedor(prisma, {
    proveedorId: entrada.proveedorId ?? null,
    nitDetectado: comprobante.nit,
    textoCrudo,
  });
  advertencias.push(...advProveedor);

  const productosDb = (await prisma.producto.findMany({
    where: { activo: true },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      ingredienteactivo: true,
      precioref: true,
      unidad: { select: { abreviatura: true } },
    },
    orderBy: { nombre: "asc" },
  })) as ProductoDb[];

  if (productosDb.length === 0) {
    advertencias.push("No hay productos activos en el catálogo para comparar.");
  }

  const indice = construirIndiceProductos(productosDb);
  const lineas = parsearItems(textoCrudo);

  const items = lineas.map((l) => mapearItem(l, indice, entrada.confianza));

  if (items.length === 0) {
    advertencias.push("No se detectaron líneas de producto en el documento.");
  }

  const sinMapear = items.filter((i) => i.productoid === null).length;
  if (sinMapear > 0) {
    advertencias.push(
      `${sinMapear} de ${items.length} producto(s) no pudieron asociarse al catálogo.`
    );
  }

  const requiereRevisionManual =
    entrada.confianza < UMBRAL_CONFIANZA_GLOBAL ||
    items.length === 0 ||
    items.some((i) => i.requiereRevision);

  return {
    tipo: "ok",
    escaneo: {
      confianza: entrada.confianza,
      motor: MOTOR_OCR,
      textoCrudo,
      comprobante,
      proveedor,
      items,
      advertencias,
      requiereRevisionManual,
    },
  };
}
