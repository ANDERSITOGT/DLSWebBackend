import prisma from "../../core/prisma";
import {
  ESTADO_DOCUMENTO_APROBADO,
  TIPO_DOCUMENTO_AJUSTE,
  TIPO_DOCUMENTO_DEVOLUCION,
  TIPO_DOCUMENTO_INGRESO,
  TIPO_DOCUMENTO_SALIDA,
} from "../../core/constants";

// ===============================
// Tipos
// ===============================
export type EstadoStock = "Normal" | "Bajo" | "Crítico";
export type EstadoProducto = "ACTIVO" | "INACTIVO";

export type InventarioProductoDTO = {
  id: string;
  nombre: string;
  codigo: string;
  detalle: string;
  categoria: string;
  unidad: string;
  stockTotal: string;
  estadoProducto: EstadoProducto;
  estadoStock: EstadoStock;
};

export type MovimientoDetalleDTO = {
  id: string;
  documentoId: string;
  documentoUuid: string;
  tipo: string;
  cantidadConSigno: string;
  unidad: string;
  bodega: string;
  lote: string | null;
  fecha: string | null;
};

export type DetalleProductoDTO = {
  producto: {
    id: string;
    nombre: string;
    codigo: string;
    detalle: string;
    categoria: string;
    unidad: string;
    estadoProducto: EstadoProducto;
  };
  existenciaTotal: {
    cantidad: number;
    unidad: string;
    texto: string;
    estadoStock: EstadoStock;
  };
  movimientos: MovimientoDetalleDTO[];
};

export type CategoriaFiltroDTO = {
  id: string;
  nombre: string;
};

// ===============================
// Helpers
// ===============================
function calcularEstadoStock(cantidad: number): EstadoStock {
  if (cantidad <= 50) return "Crítico";
  if (cantidad <= 100) return "Bajo";
  return "Normal";
}

function numeroDesdeDecimal(value: any): number {
  if (value == null) return 0;
  return Number(value);
}

// ===============================
// Servicio principal
// ===============================
export const inventarioService = {

  // --------------------------------------------------
  // 1. LISTADO OPTIMIZADO (Server-Side Filtering)
  // --------------------------------------------------
  async getListadoProductos(opciones?: { limit?: number; search?: string; categoria?: string }): Promise<InventarioProductoDTO[]> {

    // A. Construir Filtros (WHERE)
    const whereClause: any = {};

    if (opciones?.search) {
      whereClause.OR = [
        { nombre: { contains: opciones.search, mode: 'insensitive' } },
        { codigo: { contains: opciones.search, mode: 'insensitive' } }
      ];
    }

    if (opciones?.categoria) {
      whereClause.categoria = { nombre: opciones.categoria };
    }

    // B. Definir Ordenamiento (ORDER BY)
    // Estrategia: Si el usuario NO busca nada, le mostramos lo que más se mueve.
    let orderByClause: any = { nombre: 'asc' };

    if (!opciones?.search && !opciones?.categoria) {
        // "Los más usados": Ordenar por cantidad de movimientos en el historial
        orderByClause = { documento_item: { _count: 'desc' } };
    }

    // C. Consulta a Base de Datos (Solo traemos los necesarios)
    const productos = await prisma.producto.findMany({
      where: whereClause,
      take: opciones?.limit, // Aplica el límite (30 o undefined para todos)
      orderBy: orderByClause,
      include: {
        categoria: true,
        unidad: true,
      },
    });

    if (productos.length === 0) return [];

    // D. Cálculo de Stock (Solo para los productos recuperados)
    const productIds = productos.map(p => p.id);

    const items = await prisma.documento_item.findMany({
      where: {
          productoid: { in: productIds }, // Optimización vital
          documento: { estado: ESTADO_DOCUMENTO_APROBADO }
      },
      select: {
          productoid: true,
          cantidad: true,
          documento: { select: { tipo: true, proveedorid: true } }
      }
    });

    // Sumar en memoria
    const existencias: Record<string, number> = {};

    for (const item of items) {
      const doc = item.documento;
      if (!doc) continue;
      const qty = numeroDesdeDecimal(item.cantidad);
      let signo = 0;

      if (doc.tipo === TIPO_DOCUMENTO_INGRESO) signo = 1;
      else if (doc.tipo === TIPO_DOCUMENTO_SALIDA) signo = -1;
      else if (doc.tipo === TIPO_DOCUMENTO_AJUSTE) signo = 1;
      else if (doc.tipo === TIPO_DOCUMENTO_DEVOLUCION) signo = doc.proveedorid ? -1 : 1;

      if (signo !== 0) {
        const key = item.productoid;
        if (!existencias[key]) existencias[key] = 0;
        existencias[key] += signo * qty;
      }
    }

    // E. Construir respuesta
    return productos.map((p) => {
      const unidadAbrev = p.unidad?.abreviatura ?? "";
      const stockNumero = existencias[p.id] ?? 0;

      return {
        id: p.id,
        nombre: p.nombre,
        codigo: p.codigo,
        detalle: p.ingredienteactivo ?? "",
        categoria: p.categoria?.nombre ?? "",
        unidad: unidadAbrev,
        stockTotal: `${stockNumero} ${unidadAbrev}`.trim(),
        estadoProducto: p.activo ? "ACTIVO" : "INACTIVO",
        estadoStock: calcularEstadoStock(stockNumero),
      };
    });
  },

  // --------------------------------------------------
  // 2. DETALLE / KARDEX (Restaurado)
  // --------------------------------------------------
  async getDetalleProducto(productoId: string): Promise<DetalleProductoDTO> {
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      include: { categoria: true, unidad: true },
    });

    if (!producto) throw new Error("Producto no encontrado");

    // Historial para visualización (últimos 100)
    const movimientosRaw = await prisma.documento_item.findMany({
      where: {
          productoid: productoId,
          documento: { estado: ESTADO_DOCUMENTO_APROBADO }
      },
      include: {
        documento: true,
        unidad: true,
        lote: true,
      },
      orderBy: { createdat: "desc" },
      take: 100,
    });

    const bodegas = await prisma.bodega.findMany();
    const bodegasMap = new Map<string, string>();
    for (const b of bodegas) bodegasMap.set(b.id, b.nombre);

    // Cálculo total histórico exacto
    const allItems = await prisma.documento_item.findMany({
        where: { productoid: productoId, documento: { estado: ESTADO_DOCUMENTO_APROBADO } },
        select: { cantidad: true, documento: { select: { tipo: true, proveedorid: true } } }
    });

    let existenciaTotalCalculada = 0;
    for (const it of allItems) {
        const q = numeroDesdeDecimal(it.cantidad);
        let s = 0;
        if (it.documento.tipo === TIPO_DOCUMENTO_INGRESO) s = 1;
        else if (it.documento.tipo === TIPO_DOCUMENTO_SALIDA) s = -1;
        else if (it.documento.tipo === TIPO_DOCUMENTO_AJUSTE) s = 1;
        else if (it.documento.tipo === TIPO_DOCUMENTO_DEVOLUCION) s = it.documento.proveedorid ? -1 : 1;

        existenciaTotalCalculada += (s * q);
    }

    const movimientos: MovimientoDetalleDTO[] = movimientosRaw.map((item) => {
      const doc = item.documento;
      if (!doc) return null as any;

      const qty = numeroDesdeDecimal(item.cantidad);
      let signo = 0;
      let tipoTexto = doc.tipo as string;

      switch (doc.tipo) {
        case TIPO_DOCUMENTO_INGRESO: signo = 1; break;
        case TIPO_DOCUMENTO_SALIDA: signo = -1; break;
        case TIPO_DOCUMENTO_AJUSTE: signo = 1; break;
        case TIPO_DOCUMENTO_DEVOLUCION:
          if (doc.proveedorid) { signo = -1; tipoTexto = "DEV. PROVEEDOR"; }
          else { signo = 1; tipoTexto = "DEV. INTERNA"; }
          break;
        default: signo = 0;
      }

      const finalQty = signo * qty;
      const cantidadConSigno = finalQty > 0 ? `+${Math.abs(finalQty)}` : `-${Math.abs(finalQty)}`;

      let bodegaTexto = "";
      const origenId = (doc as any).bodegaorigenid;
      const destinoId = (doc as any).bodegadestinoid;

      if (doc.tipo === "TRANSFERENCIA") {
        bodegaTexto = `${origenId ? bodegasMap.get(origenId) : "?"} → ${destinoId ? bodegasMap.get(destinoId) : "?"}`;
      } else if (signo > 0) {
         bodegaTexto = destinoId ? bodegasMap.get(destinoId) || "" : "";
      } else {
         bodegaTexto = origenId ? bodegasMap.get(origenId) || "" : "";
      }

      return {
        id: item.id,
        documentoId: doc.consecutivo ?? doc.id,
        documentoUuid: doc.id,
        tipo: tipoTexto,
        cantidadConSigno,
        unidad: item.unidad?.abreviatura ?? "",
        bodega: bodegaTexto || "General",
        lote: item.lote?.codigo ?? null,
        fecha: doc.fecha ? doc.fecha.toISOString() : null,
      };
    }).filter(Boolean);

    const unidadAbrev = producto.unidad?.abreviatura ?? "";

    return {
      producto: {
        id: producto.id,
        nombre: producto.nombre,
        codigo: producto.codigo,
        detalle: producto.ingredienteactivo ?? "",
        categoria: producto.categoria?.nombre ?? "",
        unidad: unidadAbrev,
        estadoProducto: producto.activo ? "ACTIVO" : "INACTIVO",
      },
      existenciaTotal: {
        cantidad: existenciaTotalCalculada,
        unidad: unidadAbrev,
        texto: `${existenciaTotalCalculada} ${unidadAbrev}`.trim(),
        estadoStock: calcularEstadoStock(existenciaTotalCalculada),
      },
      movimientos,
    };
  },

  async getCategorias(): Promise<CategoriaFiltroDTO[]> {
    const categorias = await prisma.categoria.findMany({ orderBy: { nombre: "asc" } });
    return categorias.map((c) => ({ id: c.id, nombre: c.nombre }));
  },
};

export default inventarioService;