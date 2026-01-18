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
  documentoUuid: string; // ID Real para la BD
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
  // Listado de productos (Cálculo Masivo Optimizado)
  // --------------------------------------------------
  async getListadoProductos(): Promise<InventarioProductoDTO[]> {
    const productos = await prisma.producto.findMany({
      include: {
        categoria: true,
        unidad: true,
      },
      orderBy: { nombre: "asc" },
    });

    // Traemos todos los items aprobados
    const items = await prisma.documento_item.findMany({
      where: {
          documento: { estado: "APROBADO" }
      },
      include: { 
          documento: { 
              select: { tipo: true, proveedorid: true } // Solo traemos lo necesario para el signo
          } 
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
            signo = 1;
            break;
        case "SALIDA":
            signo = -1;
            break;
        case "AJUSTE":
            // En Ajustes, confiamos en el signo guardado en la BD (si usas -10 o 10).
            // Pero como la DB guarda "cantidad" positivo generalmente, aquí definimos la regla:
            // Por ahora asumimos que Ajuste SUMA. 
            // TODO: Si implementamos Ajuste Negativo, deberíamos guardar el signo o un subtipo.
            // Para simplificar tu modelo actual: Asumiremos que AJUSTE siempre SUMA,
            // y si quieres restar usas SALIDA o una lógica de cantidad negativa si la DB lo permite.
            // *MEJORA*: Si permites guardar cantidad negativa en la BD, esto funciona directo.
            // Si no, definimos: Ajuste = +1. (Requiere "Salida por Ajuste" como otro tipo o signo).
            // Dado tu esquema Decimal, asumimos que guardarás -10 si es resta.
            signo = 1; 
            break;
        case "DEVOLUCION":
            // AQUÍ LA LÓGICA IMPORTANTE:
            // Si tiene proveedor -> Es Salida (Resta)
            // Si no tiene proveedor -> Es Entrada Interna (Suma)
            if (doc.proveedorid) {
                signo = -1;
            } else {
                signo = 1;
            }
            break;
        case "TRANSFERENCIA":
            // En el inventario general (suma de todas las bodegas), la transferencia es neutra (0).
            // Pero si filtras por bodega, una suma y otra resta.
            // Como este reporte es GLOBAL, es 0.
            signo = 0;
            break;
        default:
            signo = 0;
      }

      // Aplicar el signo a la cantidad (si la cantidad en BD ya viene negativa, esto la respeta)
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
  // Detalle de un producto (Kardex Detallado)
  // --------------------------------------------------
  async getDetalleProducto(productoId: string): Promise<DetalleProductoDTO> {
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      include: { categoria: true, unidad: true },
    });

    if (!producto) throw new Error("Producto no encontrado");

    // Traemos items de documentos APROBADOS
    const movimientosRaw = await prisma.documento_item.findMany({
      where: { 
          productoid: productoId,
          documento: { estado: "APROBADO" } 
      },
      include: {
        documento: true, 
        unidad: true,
        lote: true,
      },
      orderBy: { createdat: "desc" }, // Del más reciente al más antiguo
      take: 100, // Aumentamos el historial
    });

    const bodegas = await prisma.bodega.findMany();
    const bodegasMap = new Map<string, string>();
    for (const b of bodegas) bodegasMap.set(b.id, b.nombre);

    // Nota: Para calcular la existencia actual exacta, deberíamos sumar TODOS los movimientos históricos,
    // no solo los últimos 100.
    // Hacemos una consulta agregada rápida para el total real.
    const allItems = await prisma.documento_item.findMany({
        where: { productoid: productoId, documento: { estado: "APROBADO" } },
        select: { cantidad: true, documento: { select: { tipo: true, proveedorid: true } } }
    });

    let existenciaTotalCalculada = 0;
    for (const it of allItems) {
        const q = numeroDesdeDecimal(it.cantidad);
        let s = 0;
        if (it.documento.tipo === "INGRESO") s = 1;
        else if (it.documento.tipo === "SALIDA") s = -1;
        else if (it.documento.tipo === "AJUSTE") s = 1; 
        else if (it.documento.tipo === "DEVOLUCION") s = it.documento.proveedorid ? -1 : 1;
        
        existenciaTotalCalculada += (s * q);
    }

    // Procesamos la lista visual
    const movimientos: MovimientoDetalleDTO[] = movimientosRaw.map((item) => {
      const doc = item.documento;
      if (!doc) return null as any;

      const qty = numeroDesdeDecimal(item.cantidad);
      let signo = 0;
      let tipoTexto = doc.tipo as string;
      
      switch (doc.tipo) {
        case "INGRESO":
          signo = 1;
          break;
        case "SALIDA":
          signo = -1;
          break;
        case "AJUSTE":
          signo = 1; // Asumiendo positivo
          // Si la cantidad fuera negativa en BD, se pintaría roja sola.
          break;
        case "DEVOLUCION":
          if (doc.proveedorid) {
              signo = -1;
              tipoTexto = "DEV. PROVEEDOR"; // Etiqueta más clara
          } else {
              signo = 1;
              tipoTexto = "DEV. INTERNA";
          }
          break;
        default:
          signo = 0;
      }

      // Formato visual: "+10" o "-5"
      // Si la cantidad original ya es negativa (ej. ajuste -5), respetamos ese signo visualmente
      const finalQty = signo * qty;
      const cantidadConSigno = finalQty > 0 ? `+${Math.abs(finalQty)}` : `-${Math.abs(finalQty)}`;

      // Lógica de texto de bodega
      let bodegaTexto = "";
      const origenId = (doc as any).bodegaorigenid;
      const destinoId = (doc as any).bodegadestinoid;
      const origen = origenId ? bodegasMap.get(origenId) : "";
      const destino = destinoId ? bodegasMap.get(destinoId) : "";

      if (doc.tipo === "TRANSFERENCIA") {
        bodegaTexto = `${origen || "?"} → ${destino || "?"}`;
      } else if (doc.tipo === "INGRESO" || (doc.tipo === "DEVOLUCION" && !doc.proveedorid)) {
         // Entradas (Ingreso o Dev Interna) van a una bodega destino (o se asume la del doc)
         bodegaTexto = destino || origen || ""; 
      } else {
         // Salidas salen de una bodega origen
         bodegaTexto = origen || destino || "";
      }

      return {
        id: item.id,
        documentoId: doc.consecutivo ?? doc.id,
        documentoUuid: doc.id,
        tipo: tipoTexto, // Usamos el texto enriquecido
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