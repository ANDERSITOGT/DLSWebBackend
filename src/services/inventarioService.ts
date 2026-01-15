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
  stockTotal: string; 
  estadoProducto: EstadoProducto;
  estadoStock: EstadoStock;
};

export type MovimientoDetalleDTO = {
  id: string;
  documentoId: string;   // Visual: "SAL-2026-001"
  documentoUuid: string; // 👈 NUEVO: ID Real para la BD
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
  // Listado de productos
  // --------------------------------------------------
  async getListadoProductos(): Promise<InventarioProductoDTO[]> {
    const productos = await prisma.producto.findMany({
      include: {
        categoria: true,
        unidad: true,
      },
      orderBy: { nombre: "asc" },
    });

    const items = await prisma.documento_item.findMany({
      include: { documento: true },
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
        case "AJUSTE": // Asumimos ajuste positivo por ahora
          signo = 1;
          break;
        case "SALIDA":
          signo = -1;
          break;
        case "TRANSFERENCIA":
          signo = 0;
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

    const resultado: InventarioProductoDTO[] = productos.map((p) => {
      const unidadAbrev = p.unidad?.abreviatura ?? "";
      const categoriaNombre = p.categoria?.nombre ?? "";
      const stockNumero = existencias[p.id] ?? 0;

      return {
        id: p.id,
        nombre: p.nombre,
        codigo: p.codigo,
        detalle: p.ingredienteactivo ?? "",
        categoria: categoriaNombre,
        unidad: unidadAbrev,
        stockTotal: `${stockNumero} ${unidadAbrev}`.trim(),
        estadoProducto: p.activo ? "ACTIVO" : "INACTIVO",
        estadoStock: calcularEstadoStock(stockNumero),
      };
    });

    return resultado;
  },

  // --------------------------------------------------
  // Detalle de un producto (CORREGIDO)
  // --------------------------------------------------
  async getDetalleProducto(productoId: string): Promise<DetalleProductoDTO> {
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      include: { categoria: true, unidad: true },
    });

    if (!producto) throw new Error("Producto no encontrado");

    const movimientosRaw = await prisma.documento_item.findMany({
      where: { productoid: productoId },
      include: {
        documento: true, 
        unidad: true,
        lote: true,
      },
      orderBy: { createdat: "desc" },
      take: 50, 
    });

    const bodegas = await prisma.bodega.findMany();
    const bodegasMap = new Map<string, string>();
    for (const b of bodegas) bodegasMap.set(b.id, b.nombre);

    let existencia = 0;

    const movimientos: MovimientoDetalleDTO[] = movimientosRaw.map((item) => {
      const doc = item.documento;
      if (!doc) return null as any;

      const qty = numeroDesdeDecimal(item.cantidad);
      let signo = 0;
      
      switch (doc.tipo) {
        case "INGRESO":
        case "DEVOLUCION":
        case "AJUSTE":
          signo = 1;
          break;
        case "SALIDA":
          signo = -1;
          break;
        default:
          signo = 0;
      }

      existencia += signo * qty;

      const cantidadConSigno = signo === 0 ? `${qty}` : `${signo > 0 ? "+" : "-"}${qty}`;

      // Lógica de texto de bodega
      let bodegaTexto = "";
      const origenId = (doc as any).origenid;
      const destinoId = (doc as any).destinoid;
      const origen = origenId ? bodegasMap.get(origenId) : "";
      const destino = destinoId ? bodegasMap.get(destinoId) : "";

      if (doc.tipo === "TRANSFERENCIA") {
        bodegaTexto = `${origen || "?"} → ${destino || "?"}`;
      } else if (["INGRESO", "AJUSTE"].includes(doc.tipo)) {
        bodegaTexto = destino || origen || "";
      } else {
        bodegaTexto = origen || destino || "";
      }

      return {
        id: item.id,
        documentoId: doc.consecutivo ?? doc.id, // Código visual
        documentoUuid: doc.id,                  // 👈 ID Real (UUID)
        tipo: doc.tipo,
        cantidadConSigno,
        unidad: item.unidad?.abreviatura ?? "",
        bodega: bodegaTexto,
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
        cantidad: existencia,
        unidad: unidadAbrev,
        texto: `${existencia} ${unidadAbrev}`.trim(),
        estadoStock: calcularEstadoStock(existencia),
      },
      movimientos,
    };
  },

  async getCategorias(): Promise<CategoriaFiltroDTO[]> {
    const categorias = await prisma.categoria.findMany({ orderBy: { nombre: "asc" } });
    return categorias.map((c) => ({ id: c.id, nombre: c.nombre }));
  },
};

// Exportación por defecto necesaria para las rutas
export default inventarioService;