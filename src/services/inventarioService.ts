// src/services/inventarioService.ts
import prisma from "../prisma";

// ===============================
// Tipos que usa el frontend
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
  stockTotal: string; // ej. "40 kg"
  estadoProducto: EstadoProducto;
  estadoStock: EstadoStock;
};

export type MovimientoDetalleDTO = {
  id: string;
  documentoId: string;
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
  // 1. REGLA DE NEGOCIO ACTUALIZADA
  // Antes: <= 0 (Crítico), < 50 (Bajo)
  // Ahora: <= 50 (Crítico), <= 100 (Bajo) - Ajustamos Bajo para tener margen de alerta
  if (cantidad <= 50) return "Crítico";
  if (cantidad <= 100) return "Bajo"; 
  return "Normal";
}

function numeroDesdeDecimal(value: any): number {
  if (value == null) return 0;
  // Prisma Decimal, string o number
  return Number(value);
}

// ===============================
// Servicio principal
// ===============================
export const inventarioService = {
  // --------------------------------------------------
  // Listado de productos para el módulo Inventario
  // --------------------------------------------------
  async getListadoProductos(): Promise<InventarioProductoDTO[]> {
    // 1) Traemos productos básicos
    const productos = await prisma.producto.findMany({
      include: {
        categoria: true,
        unidad: true,
      },
      orderBy: {
        nombre: "asc",
      },
    });

    // 2) Calculamos existencias a partir de documento_item + documento
    const items = await prisma.documento_item.findMany({
      include: {
        documento: true,
      },
    });

    const existencias: Record<string, number> = {};

    for (const item of items) {
      const doc = item.documento;
      if (!doc) continue;

      const qty = numeroDesdeDecimal(item.cantidad);
      let signo = 0;

      switch (doc.tipo) {
        case "INGRESO":
        case "DEVOLUCION":
          signo = 1;
          break;
        case "SALIDA":
          signo = -1;
          break;
        case "TRANSFERENCIA":
          // Para el total global, la transferencia no cambia existencias
          signo = 0;
          break;
        case "AJUSTE":
          // De momento lo tratamos como suma directa
          signo = 1;
          break;
        default:
          signo = 0;
      }

      if (signo !== 0) {
        const key = item.productoid;
        if (!existencias[key]) existencias[key] = 0;
        existencias[key] += signo * qty;
      }
    }

    // 3) Armamos DTO para el frontend
    const resultado: InventarioProductoDTO[] = productos.map((p) => {
      const unidadAbrev = p.unidad?.abreviatura ?? "";
      const categoriaNombre = p.categoria?.nombre ?? "";
      const stockNumero = existencias[p.id] ?? 0;

      const estadoProducto: EstadoProducto = p.activo ? "ACTIVO" : "INACTIVO";
      const estadoStock = calcularEstadoStock(stockNumero);

      return {
        id: p.id,
        nombre: p.nombre,
        codigo: p.codigo,
        detalle: p.ingredienteactivo ?? "",
        categoria: categoriaNombre,
        unidad: unidadAbrev,
        stockTotal: `${stockNumero} ${unidadAbrev}`.trim(),
        estadoProducto,
        estadoStock,
      };
    });

    return resultado;
  },

  // --------------------------------------------------
  // Detalle de un producto: info + existencia + movimientos
  // --------------------------------------------------
  async getDetalleProducto(productoId: string): Promise<DetalleProductoDTO> {
    // 1) Info básica del producto
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      include: {
        categoria: true,
        unidad: true,
      },
    });

    if (!producto) {
      throw new Error("Producto no encontrado");
    }

    // 2) Movimientos del producto
    const movimientosRaw = await prisma.documento_item.findMany({
      where: { productoid: productoId },
      include: {
        documento: true, 
        unidad: true,
        lote: true,
      },
      orderBy: {
        createdat: "desc", // O fecha del documento si prefieres orden lógico
      },
      take: 50, // 👈 2. LÍMITE AUMENTADO A 50
    });

    // 2.1) Cargamos las bodegas para poder traducir origenid/destinoid a nombres
    const bodegas = await prisma.bodega.findMany();
    const bodegasMap = new Map<string, string>();
    for (const b of bodegas) {
      bodegasMap.set(b.id, b.nombre);
    }

    let existencia = 0;

    const movimientos: MovimientoDetalleDTO[] = movimientosRaw.map((item) => {
      const doc = item.documento;
      if (!doc) return null as any;

      const qty = numeroDesdeDecimal(item.cantidad);

      let signo = 0;
      switch (doc.tipo) {
        case "INGRESO":
        case "DEVOLUCION":
          signo = 1;
          break;
        case "SALIDA":
          signo = -1;
          break;
        case "TRANSFERENCIA":
          signo = 0;
          break;
        case "AJUSTE":
          signo = 1;
          break;
        default:
          signo = 0;
      }

      existencia += signo * qty;

      const cantidadConSigno =
        signo === 0 ? `${qty}` : `${signo > 0 ? "+" : "-"}${qty}`;

      // Bodega (usando campos origenid/destinoid del documento)
      let bodegaTexto = "";
      const origenId = (doc as any).origenid as string | null | undefined;
      const destinoId = (doc as any).destinoid as string | null | undefined;

      const origenNombre = origenId ? bodegasMap.get(origenId) ?? "" : "";
      const destinoNombre = destinoId ? bodegasMap.get(destinoId) ?? "" : "";

      switch (doc.tipo) {
        case "INGRESO":
        case "AJUSTE":
          bodegaTexto = destinoNombre || origenNombre || "";
          break;
        case "SALIDA":
          bodegaTexto = origenNombre || destinoNombre || "";
          break;
        case "TRANSFERENCIA":
          bodegaTexto = `${origenNombre || "?"} → ${destinoNombre || "?"}`;
          break;
        default:
          bodegaTexto = origenNombre || destinoNombre || "";
      }

      const unidadAbrev = item.unidad?.abreviatura ?? "";
      const fechaIso = doc.fecha ? doc.fecha.toISOString() : null;

      return {
        id: item.id,
        documentoId: doc.consecutivo || doc.id, // Preferimos consecutivo visual
        tipo: doc.tipo,
        cantidadConSigno,
        unidad: unidadAbrev,
        bodega: bodegaTexto,
        lote: item.lote?.codigo ?? null,
        fecha: fechaIso,
      };
    }).filter(Boolean);

    const unidadAbrev = producto.unidad?.abreviatura ?? "";
    const estadoStock = calcularEstadoStock(existencia);

    const detalle: DetalleProductoDTO = {
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
        cantidad: existencia,
        unidad: unidadAbrev,
        texto: `${existencia} ${unidadAbrev}`.trim(),
        estadoStock,
      },
      movimientos,
    };

    return detalle;
  },

  // --------------------------------------------------
  // Categorías para el filtro del frontend
  // --------------------------------------------------
  async getCategorias(): Promise<CategoriaFiltroDTO[]> {
    const categorias = await prisma.categoria.findMany({
      orderBy: {
        nombre: "asc",
      },
    });

    return categorias.map((c) => ({
      id: c.id,
      nombre: c.nombre,
    }));
  },
};