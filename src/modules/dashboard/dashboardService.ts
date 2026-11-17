import prisma from "../../core/prisma";
import {
  ESTADO_DOCUMENTO_APROBADO,
  TIPO_DOCUMENTO_AJUSTE,
  TIPO_DOCUMENTO_DEVOLUCION,
  TIPO_DOCUMENTO_INGRESO,
  TIPO_DOCUMENTO_SALIDA,
} from "../../core/constants";

// ===============================
// Tipos (contrato con el frontend)
// ===============================
export type Formato = "numero" | "moneda" | "libras" | "metros";
export type ModuloDashboard = "BODEGA" | "COSECHAS";

export type Kpi = {
  id: string;
  label: string;
  value: number;
  formato: Formato;
  descripcion: string;
  variacionPct: number | null;
  tendencia: number[];
  icono?:
    | "movimientos"
    | "stock"
    | "solicitudes"
    | "inventario"
    | "cosecha"
    | "despacho"
    | "lote";
};

export type Grafica = {
  id: string;
  titulo: string;
  tipo: "barras" | "lineas";
  series: { key: string; label: string }[];
  datos: ({ etiqueta: string } & Record<string, number | string>)[];
};

export type ResumenItem = {
  id: string;
  label: string;
  value: number;
  total: number | null;
  formato: Formato;
};

export type Alerta = {
  id: string;
  nivel: "info" | "warning" | "danger";
  titulo: string;
  descripcion: string;
  cantidad: number;
  ruta: string;
};

export type DashboardResponse = {
  modulo: ModuloDashboard;
  generadoEn: string;
  kpis: Kpi[];
  graficas: Grafica[];
  resumenDia: ResumenItem[];
  alertas: Alerta[];
};

export type UsuarioDashboard = { id: string; rol: string | null };

// ===============================
// Helpers de fecha (America/Guatemala = UTC-6, sin horario de verano)
// ===============================
const OFFSET_GT_MS = 6 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const STOCK_CRITICO_MAX = 50; // mismo umbral "Crítico" de inventarioService
const ESTADOS_SOLICITUD = ["PENDIENTE", "APROBADA", "ENTREGADA", "RECHAZADA"] as const;

type Ventana = {
  keys: string[];
  etiquetas: string[];
  inicioPrevio: Date;
  inicio: Date;
  fin: Date; // inicio del día siguiente (GT)
  ahora: Date;
  dias: number;
};

function claveDia(fecha: Date): string {
  return new Date(fecha.getTime() - OFFSET_GT_MS).toISOString().slice(0, 10);
}

function construirVentana(dias: number): Ventana {
  const ahora = new Date();
  const hoyKey = claveDia(ahora);
  const inicioHoy = new Date(
    new Date(`${hoyKey}T00:00:00.000Z`).getTime() + OFFSET_GT_MS
  );
  const inicio = new Date(inicioHoy.getTime() - (dias - 1) * DIA_MS);
  const inicioPrevio = new Date(inicio.getTime() - dias * DIA_MS);
  const fin = new Date(inicioHoy.getTime() + DIA_MS);

  const keys: string[] = [];
  const etiquetas: string[] = [];
  for (let i = 0; i < dias; i++) {
    const key = claveDia(new Date(inicio.getTime() + i * DIA_MS));
    keys.push(key);
    const d = new Date(`${key}T00:00:00.000Z`);
    etiquetas.push(`${DIAS_SEMANA[d.getUTCDay()]} ${key.slice(8, 10)}`);
  }

  return { keys, etiquetas, inicioPrevio, inicio, fin, ahora, dias };
}

// ===============================
// Helpers numéricos
// ===============================
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const redondear = (v: number, dec = 2): number => {
  const f = 10 ** dec;
  return Math.round(v * f) / f;
};

function variacion(actual: number, previo: number): number | null {
  if (previo === 0) return actual === 0 ? 0 : null;
  return redondear(((actual - previo) / Math.abs(previo)) * 100, 1);
}

type Serie = { porDia: number[]; total: number; totalPrevio: number };

// Suma `valor` por día dentro de la ventana y acumula el periodo anterior.
function agruparPorDia<T>(
  items: T[],
  fecha: (item: T) => Date | null,
  valor: (item: T) => number,
  v: Ventana
): Serie {
  const mapa = new Map<string, number>();
  let totalPrevio = 0;

  for (const item of items) {
    const f = fecha(item);
    if (!f) continue;
    if (f < v.inicio) {
      if (f >= v.inicioPrevio) totalPrevio += valor(item);
    } else if (f < v.fin) {
      const k = claveDia(f);
      mapa.set(k, (mapa.get(k) ?? 0) + valor(item));
    }
  }

  const porDia = v.keys.map((k) => redondear(mapa.get(k) ?? 0));
  const total = redondear(porDia.reduce((a, b) => a + b, 0));
  return { porDia, total, totalPrevio: redondear(totalPrevio) };
}

const hoy = (s: Serie): number => s.porDia[s.porDia.length - 1] ?? 0;

// ===============================
// BODEGA
// ===============================
async function dashboardBodega(
  usuario: UsuarioDashboard,
  v: Ventana
): Promise<Omit<DashboardResponse, "modulo" | "generadoEn">> {
  const soloPropios = usuario.rol === "SOLICITANTE";

  const filtroDoc: any = soloPropios
    ? { OR: [{ solicitanteid: usuario.id }, { creadorid: usuario.id }] }
    : {};
  const filtroSol: any = soloPropios ? { solicitanteid: usuario.id } : {};

  const [
    documentos,
    solicitudes,
    productos,
    itemsStock,
    itemsSalida,
    pendientesActuales,
    pendientesViejas,
    borradoresViejos,
  ] = await Promise.all([
    prisma.documento.findMany({
      where: {
        ...filtroDoc,
        estado: ESTADO_DOCUMENTO_APROBADO,
        fecha: { gte: v.inicioPrevio, lt: v.fin },
      },
      select: { tipo: true, fecha: true },
    }),
    prisma.solicitud.findMany({
      where: {
        ...filtroSol,
        OR: [
          { fecha: { gte: v.inicioPrevio, lt: v.fin } },
          { fecha: null, createdat: { gte: v.inicioPrevio, lt: v.fin } },
        ],
      },
      select: { estado: true, fecha: true, createdat: true },
    }),
    prisma.producto.findMany({
      where: { activo: true },
      select: { id: true, precioref: true },
    }),
    prisma.documento_item.findMany({
      where: { documento: { estado: ESTADO_DOCUMENTO_APROBADO } },
      select: {
        productoid: true,
        cantidad: true,
        documento: {
          select: { tipo: true, proveedorid: true, fecha: true, createdat: true },
        },
      },
    }),
    prisma.documento_item.findMany({
      where: {
        documento: {
          ...filtroDoc,
          tipo: TIPO_DOCUMENTO_SALIDA,
          estado: ESTADO_DOCUMENTO_APROBADO,
          fecha: { gte: v.inicio, lt: v.fin },
        },
      },
      select: { cantidad: true, producto: { select: { nombre: true } } },
    }),
    prisma.solicitud.count({ where: { ...filtroSol, estado: "PENDIENTE" } }),
    prisma.solicitud.count({
      where: {
        ...filtroSol,
        estado: "PENDIENTE",
        OR: [
          { fecha: { lt: new Date(v.ahora.getTime() - DIA_MS) } },
          { fecha: null, createdat: { lt: new Date(v.ahora.getTime() - DIA_MS) } },
        ],
      },
    }),
    prisma.documento.count({
      where: {
        ...filtroDoc,
        estado: "BORRADOR",
        fecha: { lt: new Date(v.ahora.getTime() - 2 * DIA_MS) },
      },
    }),
  ]);

  // --- Movimientos por día ---
  const movimientos = agruparPorDia(documentos, (d) => d.fecha, () => 1, v);
  const entradas = agruparPorDia(
    documentos.filter((d) => d.tipo === TIPO_DOCUMENTO_INGRESO),
    (d) => d.fecha,
    () => 1,
    v
  );
  const salidas = agruparPorDia(
    documentos.filter((d) => d.tipo === TIPO_DOCUMENTO_SALIDA),
    (d) => d.fecha,
    () => 1,
    v
  );

  // --- Solicitudes ---
  const fechaSol = (s: { fecha: Date | null; createdat: Date | null }) =>
    s.fecha ?? s.createdat;
  const pendientesCreadas = agruparPorDia(
    solicitudes.filter((s) => s.estado === "PENDIENTE"),
    fechaSol,
    () => 1,
    v
  );
  const aprobadasHoy = agruparPorDia(
    solicitudes.filter((s) => s.estado === "APROBADA" || s.estado === "ENTREGADA"),
    fechaSol,
    () => 1,
    v
  );
  const solicitudesHoy = agruparPorDia(solicitudes, fechaSol, () => 1, v);
  const ajustes = agruparPorDia(
    documentos.filter((d) => d.tipo === TIPO_DOCUMENTO_AJUSTE),
    (d) => d.fecha,
    () => 1,
    v
  );

  const despachado = new Map<string, number>();
  for (const it of itemsSalida) {
    const nombre = it.producto?.nombre ?? "Sin nombre";
    despachado.set(nombre, (despachado.get(nombre) ?? 0) + num(it.cantidad));
  }
  const topProductos = [...despachado.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // --- Stock: se reconstruye el stock al cierre de cada día ---
  const eventos = itemsStock
    .map((it) => {
      const doc = it.documento;
      let signo = 0;
      if (doc.tipo === TIPO_DOCUMENTO_INGRESO) signo = 1;
      else if (doc.tipo === TIPO_DOCUMENTO_SALIDA) signo = -1;
      else if (doc.tipo === TIPO_DOCUMENTO_AJUSTE) signo = 1;
      else if (doc.tipo === TIPO_DOCUMENTO_DEVOLUCION)
        signo = doc.proveedorid ? -1 : 1;
      return {
        productoid: it.productoid,
        delta: signo * num(it.cantidad),
        fecha: (doc.fecha ?? doc.createdat ?? new Date(0)).getTime(),
      };
    })
    .filter((e) => e.delta !== 0)
    .sort((a, b) => a.fecha - b.fecha);

  const precios = new Map(productos.map((p) => [p.id, num(p.precioref)]));
  const stock = new Map<string, number>();
  let puntero = 0;

  const snapshot = (limite: number) => {
    while (puntero < eventos.length && eventos[puntero].fecha < limite) {
      const e = eventos[puntero++];
      stock.set(e.productoid, (stock.get(e.productoid) ?? 0) + e.delta);
    }
    let criticos = 0;
    let valor = 0;
    for (const [id, precio] of precios) {
      const s = stock.get(id) ?? 0;
      if (s <= STOCK_CRITICO_MAX) criticos++;
      if (s > 0) valor += s * precio;
    }
    return { criticos, valor: soloPropios ? 0 : redondear(valor) };
  };

  const previo = snapshot(v.inicio.getTime());
  const cierres = v.keys.map((_, i) =>
    snapshot(i === v.dias - 1 ? v.fin.getTime() : v.inicio.getTime() + (i + 1) * DIA_MS)
  );
  const actual = cierres[cierres.length - 1] ?? previo;

  const tendCriticos = cierres.map((c) => c.criticos);
  const tendValor = cierres.map((c) => c.valor);

  const kpis: Kpi[] = [
    {
      id: "movimientos-hoy",
      label: "Movimientos de hoy",
      value: hoy(movimientos),
      formato: "numero",
      descripcion: "Documentos aprobados registrados hoy",
      variacionPct: variacion(movimientos.total, movimientos.totalPrevio),
      tendencia: movimientos.porDia,
      icono: "movimientos",
    },
    {
      id: "stock-critico",
      label: "Productos en nivel crítico",
      value: actual.criticos,
      formato: "numero",
      descripcion: `Productos activos con stock de ${STOCK_CRITICO_MAX} o menos`,
      variacionPct: variacion(actual.criticos, previo.criticos),
      tendencia: tendCriticos,
      icono: "stock",
    },
    {
      id: "solicitudes-pendientes",
      label: "Solicitudes pendientes",
      value: pendientesActuales,
      formato: "numero",
      descripcion: "Solicitudes por aprobar (la tendencia muestra las nuevas por día)",
      variacionPct: variacion(pendientesCreadas.total, pendientesCreadas.totalPrevio),
      tendencia: pendientesCreadas.porDia,
      icono: "solicitudes",
    },
    {
      id: "valor-inventario",
      label: "Valor del inventario",
      value: actual.valor,
      formato: "moneda",
      descripcion: "Stock actual por precio de referencia",
      variacionPct: variacion(actual.valor, previo.valor),
      tendencia: tendValor,
      icono: "inventario",
    },
  ];

  const graficas: Grafica[] = [
    {
      id: "entradas-vs-salidas",
      titulo: "Entradas vs. salidas",
      tipo: "barras",
      series: [
        { key: "entradas", label: "Entradas" },
        { key: "salidas", label: "Salidas" },
      ],
      datos: v.keys.map((_, i) => ({
        etiqueta: v.etiquetas[i],
        entradas: entradas.porDia[i],
        salidas: salidas.porDia[i],
      })),
    },
    {
      id: "top-productos-despachados",
      titulo: "Top 5 productos despachados",
      tipo: "barras",
      series: [{ key: "cantidad", label: "Cantidad" }],
      datos: topProductos.map(([nombre, cantidad]) => ({
        etiqueta: nombre,
        cantidad: redondear(cantidad),
      })),
    },
    {
      id: "solicitudes-por-estado",
      titulo: "Solicitudes por estado",
      tipo: "barras",
      series: [{ key: "cantidad", label: "Solicitudes" }],
      datos: ESTADOS_SOLICITUD.map((estado) => ({
        etiqueta: estado.charAt(0) + estado.slice(1).toLowerCase(),
        cantidad: solicitudes.filter(
          (s) => s.estado === estado && fechaSol(s)! >= v.inicio
        ).length,
      })),
    },
  ];

  const resumenDia: ResumenItem[] = [
    { id: "ingresos-hoy", label: "Ingresos de hoy", value: hoy(entradas), total: null, formato: "numero" },
    { id: "salidas-hoy", label: "Salidas de hoy", value: hoy(salidas), total: null, formato: "numero" },
    {
      id: "solicitudes-aprobadas-hoy",
      label: "Solicitudes aprobadas",
      value: hoy(aprobadasHoy),
      total: hoy(solicitudesHoy),
      formato: "numero",
    },
    {
      id: "solicitudes-pendientes",
      label: "Solicitudes pendientes",
      value: pendientesActuales,
      total: null,
      formato: "numero",
    },
  ];

  const alertas: Alerta[] = [
    {
      id: "stock-critico",
      nivel: actual.criticos > 0 ? "danger" : "info",
      titulo: "Stock crítico",
      descripcion: `Productos con ${STOCK_CRITICO_MAX} unidades o menos`,
      cantidad: actual.criticos,
      ruta: "/bodega/inventario",
    },
    {
      id: "solicitudes-sin-atender",
      nivel: pendientesViejas > 0 ? "warning" : "info",
      titulo: "Solicitudes sin atender",
      descripcion: "Solicitudes pendientes desde hace más de 24 horas",
      cantidad: pendientesViejas,
      ruta: "/bodega/solicitudes",
    },
    {
      id: "borradores-antiguos",
      nivel: borradoresViejos > 0 ? "warning" : "info",
      titulo: "Documentos en borrador",
      descripcion: "Borradores con más de 2 días sin aprobar",
      cantidad: borradoresViejos,
      ruta: "/bodega/movimientos",
    },
    {
      id: "ajustes-periodo",
      nivel: "info",
      titulo: "Ajustes de inventario",
      descripcion: `Ajustes aprobados en los últimos ${v.dias} días`,
      cantidad: ajustes.total,
      ruta: "/bodega/movimientos",
    },
  ];

  return { kpis, graficas, resumenDia, alertas };
}

// ===============================
// COSECHAS
// ===============================
async function dashboardCosechas(
  v: Ventana
): Promise<Omit<DashboardResponse, "modulo" | "generadoEn">> {
  const [cosechas, lotesAbiertos] = await Promise.all([
    prisma.cosecha.findMany({
      where: { fecha: { gte: v.inicioPrevio, lt: v.fin } },
      select: {
        loteid: true,
        fecha: true,
        libras_campo: true,
        libras_rechazo: true,
        libras_vendidas: true,
        lote: { select: { codigo: true, areametroslineales: true } },
        boleta_cosecha: {
          select: { numero_boleta: true, libras: true, empacadora: { select: { nombre: true } } },
        },
      },
    }),
    prisma.lote.findMany({
      where: { estado: "ABIERTO" },
      select: { id: true, areametroslineales: true },
    }),
  ]);

  const campo = agruparPorDia(cosechas, (c) => c.fecha, (c) => num(c.libras_campo), v);
  const rechazo = agruparPorDia(cosechas, (c) => c.fecha, (c) => num(c.libras_rechazo), v);
  const vendidas = agruparPorDia(cosechas, (c) => c.fecha, (c) => num(c.libras_vendidas), v);

  const porcentaje = (parte: number, total: number) =>
    total > 0 ? redondear((parte / total) * 100, 1) : 0;
  const rechazoPct = porcentaje(rechazo.total, campo.total);
  const rechazoPctPrevio = porcentaje(rechazo.totalPrevio, campo.totalPrevio);
  const rechazoPctTendencia = campo.porDia.map((c, i) => porcentaje(rechazo.porDia[i], c));
  const aprovechamientoPct = porcentaje(vendidas.total, campo.total);

  // Rendimiento: libras de campo / metros lineales de los lotes cosechados
  const area = (c: (typeof cosechas)[number]) => num(c.lote?.areametroslineales);
  const rendimientoDe = (items: typeof cosechas) => {
    const lotes = new Map<string, number>();
    let libras = 0;
    for (const c of items) {
      const a = area(c);
      if (a > 0) {
        lotes.set(c.loteid, a);
        libras += num(c.libras_campo);
      }
    }
    const metros = [...lotes.values()].reduce((x, y) => x + y, 0);
    return metros > 0 ? redondear(libras / metros) : 0;
  };

  const enPeriodo = cosechas.filter((c) => c.fecha >= v.inicio && c.fecha < v.fin);
  const enPrevio = cosechas.filter((c) => c.fecha < v.inicio);
  const porDia = new Map<string, typeof cosechas>();
  for (const c of enPeriodo) {
    const k = claveDia(c.fecha);
    porDia.set(k, [...(porDia.get(k) ?? []), c]);
  }
  const rendTendencia = v.keys.map((k) => rendimientoDe(porDia.get(k) ?? []));
  const rendActual = rendimientoDe(enPeriodo);
  const rendPrevio = rendimientoDe(enPrevio);

  const kpis: Kpi[] = [
    {
      id: "libras-cosechadas",
      label: "Libras cosechadas",
      value: campo.total,
      formato: "libras",
      descripcion: "Libras de campo del periodo",
      variacionPct: variacion(campo.total, campo.totalPrevio),
      tendencia: campo.porDia,
      icono: "cosecha",
    },
    {
      id: "porcentaje-rechazo",
      label: "% de rechazo",
      value: rechazoPct,
      formato: "numero",
      descripcion: `Rechazo sobre lo cosechado (${rechazo.total} lb rechazadas)`,
      variacionPct: variacion(rechazoPct, rechazoPctPrevio),
      tendencia: rechazoPctTendencia,
      icono: "cosecha",
    },
    {
      id: "libras-vendidas",
      label: "Libras vendidas",
      value: vendidas.total,
      formato: "libras",
      descripcion: `Vendidas o despachadas (${aprovechamientoPct}% de lo cosechado)`,
      variacionPct: variacion(vendidas.total, vendidas.totalPrevio),
      tendencia: vendidas.porDia,
      icono: "despacho",
    },
    {
      id: "rendimiento-lote",
      label: "Rendimiento por lote",
      value: rendActual,
      formato: "metros",
      descripcion: "Libras por metro lineal en lotes cosechados",
      variacionPct: variacion(rendActual, rendPrevio),
      tendencia: rendTendencia,
      icono: "lote",
    },
  ];

  // Top 8 lotes por libras de campo en la ventana
  const porLote = new Map<string, number>();
  for (const c of enPeriodo) {
    const codigo = c.lote?.codigo ?? c.loteid;
    porLote.set(codigo, (porLote.get(codigo) ?? 0) + num(c.libras_campo));
  }
  const topLotes = [...porLote.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const porEmpacadora = new Map<string, number>();
  for (const c of enPeriodo) {
    for (const b of c.boleta_cosecha) {
      const nombre = b.empacadora?.nombre ?? "Sin empacadora";
      porEmpacadora.set(nombre, (porEmpacadora.get(nombre) ?? 0) + num(b.libras));
    }
  }

  const graficas: Grafica[] = [
    {
      id: "cosechas-por-periodo",
      titulo: "Cosechas por periodo",
      tipo: "lineas",
      series: [
        { key: "campo", label: "Campo" },
        { key: "vendidas", label: "Vendidas" },
      ],
      datos: v.keys.map((_, i) => ({
        etiqueta: v.etiquetas[i],
        campo: campo.porDia[i],
        vendidas: vendidas.porDia[i],
      })),
    },
    {
      id: "cosechas-por-lote",
      titulo: "Top 8 lotes por libras",
      tipo: "barras",
      series: [{ key: "libras", label: "Libras" }],
      datos: topLotes.map(([codigo, libras]) => ({
        etiqueta: codigo,
        libras: redondear(libras),
      })),
    },
    {
      id: "libras-por-empacadora",
      titulo: "Libras por empacadora",
      tipo: "barras",
      series: [{ key: "libras", label: "Libras" }],
      datos: [...porEmpacadora.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([nombre, libras]) => ({ etiqueta: nombre, libras: redondear(libras) })),
    },
  ];

  const boletasHoy = (porDia.get(v.keys[v.keys.length - 1]) ?? []).reduce(
    (acc, c) => acc + c.boleta_cosecha.length,
    0
  );

  const resumenDia: ResumenItem[] = [
    { id: "campo-hoy", label: "Libras de campo hoy", value: hoy(campo), total: null, formato: "libras" },
    { id: "rechazo-hoy", label: "Libras de rechazo hoy", value: hoy(rechazo), total: hoy(campo), formato: "libras" },
    { id: "vendidas-hoy", label: "Libras vendidas hoy", value: hoy(vendidas), total: hoy(campo), formato: "libras" },
    { id: "boletas-hoy", label: "Boletas de hoy", value: boletasHoy, total: null, formato: "numero" },
  ];

  // --- Alertas ---
  const lotesConCosecha = new Set(enPeriodo.map((c) => c.loteid));
  const sinCosecha = lotesAbiertos.filter((l) => !lotesConCosecha.has(l.id)).length;

  const sinBoleta = enPeriodo.filter(
    (c) => !c.boleta_cosecha.some((b) => b.numero_boleta && b.numero_boleta.trim() !== "")
  ).length;

  const idsAbiertos = lotesAbiertos.map((l) => l.id);
  const [docsActivos, solsActivas] = await Promise.all([
    prisma.documento_item.findMany({
      where: { loteid: { in: idsAbiertos }, documento: { fecha: { gte: v.inicio } } },
      select: { loteid: true },
      distinct: ["loteid"],
    }),
    prisma.solicitud_item.findMany({
      where: { loteid: { in: idsAbiertos }, solicitud: { fecha: { gte: v.inicio } } },
      select: { loteid: true },
      distinct: ["loteid"],
    }),
  ]);
  const conActividad = new Set<string>([
    ...lotesConCosecha,
    ...docsActivos.map((d) => d.loteid!).filter(Boolean),
    ...solsActivas.map((s) => s.loteid!).filter(Boolean),
  ]);
  const sinActividad = lotesAbiertos.filter((l) => !conActividad.has(l.id)).length;

  const sinArea = lotesAbiertos.filter((l) => num(l.areametroslineales) <= 0).length;

  // Vendidas registradas que no cuadran con la suma de sus boletas (tolerancia 0.5 lb)
  const descuadradas = enPeriodo.filter((c) => {
    if (c.libras_vendidas == null) return false;
    const enBoletas = c.boleta_cosecha.reduce((acc, b) => acc + num(b.libras), 0);
    return Math.abs(num(c.libras_vendidas) - enBoletas) > 0.5;
  }).length;

  const alertas: Alerta[] = [
    {
      id: "lotes-sin-cosecha",
      nivel: sinCosecha > 0 ? "warning" : "info",
      titulo: "Lotes sin cosecha reciente",
      descripcion: `Lotes abiertos sin cosecha registrada en los últimos ${v.dias} días`,
      cantidad: sinCosecha,
      ruta: "/cosechas/registro",
    },
    {
      id: "cosechas-sin-boleta",
      nivel: sinBoleta > 0 ? "danger" : "info",
      titulo: "Cosechas sin boleta",
      descripcion: "Cosechas del periodo sin número de boleta",
      cantidad: sinBoleta,
      ruta: "/cosechas/registro",
    },
    {
      id: "vendidas-descuadradas",
      nivel: descuadradas > 0 ? "warning" : "info",
      titulo: "Vendidas no coinciden con boletas",
      descripcion: "Cosechas cuyas libras vendidas difieren de la suma de sus boletas",
      cantidad: descuadradas,
      ruta: "/cosechas/registro",
    },
    {
      id: "lotes-sin-actividad",
      nivel: sinActividad > 0 ? "warning" : "info",
      titulo: "Lotes abiertos sin actividad",
      descripcion: `Lotes abiertos sin cosechas, insumos ni solicitudes en ${v.dias} días`,
      cantidad: sinActividad,
      ruta: "/cosechas/registro",
    },
    {
      id: "lotes-sin-area",
      nivel: "info",
      titulo: "Lotes sin metros lineales",
      descripcion: "No se puede calcular el rendimiento de estos lotes",
      cantidad: sinArea,
      ruta: "/cosechas/registro",
    },
  ];

  return { kpis, graficas, resumenDia, alertas };
}

// ===============================
// Servicio principal
// ===============================
export class DashboardForbiddenError extends Error {}

export const dashboardService = {
  async getDashboard(
    usuario: UsuarioDashboard,
    modulo: ModuloDashboard,
    dias: number
  ): Promise<DashboardResponse> {
    const rol = usuario.rol ?? "VISOR";
    const puedeVer =
      modulo === "BODEGA"
        ? ["ADMIN", "BODEGUERO", "SOLICITANTE", "VISOR"].includes(rol)
        : ["ADMIN", "COSECHA"].includes(rol);

    if (!puedeVer) {
      throw new DashboardForbiddenError("No tiene permisos para ver este módulo");
    }

    const ventana = construirVentana(dias);
    const data =
      modulo === "BODEGA"
        ? await dashboardBodega(usuario, ventana)
        : await dashboardCosechas(ventana);

    return { modulo, generadoEn: new Date().toISOString(), ...data };
  },
};
