// src/services/movimientosService.ts
import prisma from "../prisma";

// =============================
// Tipos DTO para el frontend
// =============================

export type MovimientoTipo = "INGRESO" | "SALIDA" | "TRANSFERENCIA" | "AJUSTE" | "DEVOLUCION";
export type MovimientoEstado = "BORRADOR" | "APROBADO" | "ANULADO";

export type MovimientoResumenDTO = {
  id: string;
  codigo: string; // consecutivo o id
  tipo: MovimientoTipo;
  estado: MovimientoEstado;
  origen: string | null;
  destino: string | null;
  proveedor: string | null;
  productos: string; // "2 productos"
  fecha: string | null; // ISO
};

export type ProductoEnMovimientoDTO = {
  id: string;
  productoNombre: string;
  productoCodigo: string;
  cantidad: string; // "50 kg"
  unidad: string;
  loteCodigo: string | null;
  loteId: string | null;
  fincaNombre: string | null;
};

export type MovimientoDetalleDTO = {
  id: string;
  codigo: string;
  tipo: MovimientoTipo;
  estado: MovimientoEstado;
  fecha: string | null;
  origen: string | null;
  destino: string | null;
  proveedor: string | null;
  solicitante: string | null;
  creador: string | null;
  productos: ProductoEnMovimientoDTO[];
  observacion: string | null;
};

// ===== Lotes

export type EstadoLoteFront = "ACTIVO" | "INACTIVO";

export type LoteResumenDTO = {
  id: string;
  codigo: string;
  finca: string;
  cultivo: string;
  area: string; // "2.5 mz"
  estado: EstadoLoteFront;
  aplicacionesCount: number;
};

export type LoteAplicacionDTO = {
  id: string;
  documentoId: string;
  documentoCodigo: string;
  tipo: MovimientoTipo;
  fecha: string | null;
  bodega: string | null;
  producto: string;
  cantidad: string; // "10 L"
  unidad: string;
};

export type LoteDetalleDTO = {
  lote: LoteResumenDTO;
  aplicaciones: LoteAplicacionDTO[];
};

// =============================
// Servicio
// =============================

export const movimientosService = {
  // ---------------------------------------
  // LISTADO DE DOCUMENTOS / MOVIMIENTOS
  // ---------------------------------------
  async getListadoMovimientos(): Promise<MovimientoResumenDTO[]> {
    const documentos = await prisma.documento.findMany({
      orderBy: { fecha: "desc" },
      take: 50,
      include: {
        proveedor: true,
        // nombres reales que Prisma generó al introspectar
        bodega_documento_bodegaorigenidTobodega: true,
        bodega_documento_bodegadestinoidTobodega: true,
        documento_item: {
          select: { id: true },
        },
      },
    });

    const data: MovimientoResumenDTO[] = documentos.map((d) => {
      const origen = d.bodega_documento_bodegaorigenidTobodega?.nombre ?? null;
      const destino = d.bodega_documento_bodegadestinoidTobodega?.nombre ?? null;
      const proveedor = d.proveedor?.nombre ?? null;
      const productosLabel = `${d.documento_item.length} productos`;

      return {
        id: d.id,
        codigo: d.consecutivo ?? d.id,
        tipo: d.tipo as MovimientoTipo,
        estado: d.estado as MovimientoEstado,
        origen,
        destino,
        proveedor,
        productos: productosLabel,
        fecha: d.fecha ? d.fecha.toISOString() : null,
      };
    });

    return data;
  },

  // ---------------------------------------
  // DETALLE DE UN DOCUMENTO / MOVIMIENTO
  // ---------------------------------------
  async getDetalleMovimiento(id: string): Promise<MovimientoDetalleDTO> {
    const doc = await prisma.documento.findUnique({
      where: { id },
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
            lote: {
              include: {
                finca: true,
              },
            },
          },
        },
      },
    });

    if (!doc) {
      throw new Error("Documento no encontrado");
    }

    const origen = doc.bodega_documento_bodegaorigenidTobodega?.nombre ?? null;
    const destino = doc.bodega_documento_bodegadestinoidTobodega?.nombre ?? null;
    const proveedor = doc.proveedor?.nombre ?? null;

    const solicitante =
      doc.usuario_documento_solicitanteidTousuario?.nombre ?? null;
    const creador =
      doc.usuario_documento_creadoridTousuario?.nombre ?? null;

    const productos: ProductoEnMovimientoDTO[] = doc.documento_item.map((item) => {
      const cantidadNum = Number(item.cantidad) || 0;
      const unidad = item.unidad?.abreviatura ?? "";
      const loteCodigo = item.lote?.codigo ?? null;
      const loteId = item.lote?.id ?? null;
      const fincaNombre = item.lote?.finca?.nombre ?? null;

      return {
        id: item.id,
        productoNombre: item.producto?.nombre ?? "",
        productoCodigo: item.producto?.codigo ?? "",
        cantidad: `${cantidadNum} ${unidad}`.trim(),
        unidad,
        loteCodigo,
        loteId,
        fincaNombre,
      };
    });

    return {
      id: doc.id,
      codigo: doc.consecutivo ?? doc.id,
      tipo: doc.tipo as MovimientoTipo,
      estado: doc.estado as MovimientoEstado,
      fecha: doc.fecha ? doc.fecha.toISOString() : null,
      origen,
      destino,
      proveedor,
      solicitante,
      creador,
      productos,
      observacion: doc.observacion ?? null,
    };
  },

  // ---------------------------------------
  // LISTADO DE LOTES (vista Lotes)
  // ---------------------------------------
  async getListadoLotes(): Promise<LoteResumenDTO[]> {
    const lotes = await prisma.lote.findMany({
      include: {
        finca: true,
        cultivo: true,
      },
      orderBy: {
        createdat: "desc", // campo real en BD
      },
      take: 50,
    });

    const resultado: LoteResumenDTO[] = [];

    for (const lote of lotes) {
      // campos reales: areamanzanas, areahectareas, areametroslineales
      let area = "-";
      if (lote.areamanzanas != null) {
        area = `${Number(lote.areamanzanas)} mz`;
      } else if (lote.areahectareas != null) {
        area = `${Number(lote.areahectareas)} ha`;
      } else if (lote.areametroslineales != null) {
        area = `${Number(lote.areametroslineales)} ml`;
      }

      const estadoFront: EstadoLoteFront =
        lote.estado === "ABIERTO" ? "ACTIVO" : "INACTIVO";

      // número de aplicaciones (documento_item con ese lote)
      const aplicacionesCount = await prisma.documento_item.count({
        where: {
          loteid: lote.id, // campo real en BD
          documento: {
            tipo: "SALIDA",
          },
        },
      });

      resultado.push({
        id: lote.id,
        codigo: lote.codigo,
        finca: lote.finca?.nombre ?? "",
        cultivo: lote.cultivo?.nombre ?? "",
        area,
        estado: estadoFront,
        aplicacionesCount,
      });
    }

    return resultado;
  },

  // ---------------------------------------
  // DETALLE DE LOTE (historial de aplicaciones)
  // ---------------------------------------
  async getDetalleLote(loteId: string): Promise<LoteDetalleDTO> {
    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
      include: {
        finca: true,
        cultivo: true,
      },
    });

    if (!lote) {
      throw new Error("Lote no encontrado");
    }

    let area = "-";
    if (lote.areamanzanas != null) {
      area = `${Number(lote.areamanzanas)} mz`;
    } else if (lote.areahectareas != null) {
      area = `${Number(lote.areahectareas)} ha`;
    } else if (lote.areametroslineales != null) {
      area = `${Number(lote.areametroslineales)} ml`;
    }

    const estadoFront: EstadoLoteFront =
      lote.estado === "ABIERTO" ? "ACTIVO" : "INACTIVO";

    const aplicacionesRaw = await prisma.documento_item.findMany({
      where: {
        loteid: loteId,
        documento: {
          tipo: "SALIDA",
        },
      },
      orderBy: {
        createdat: "desc",
      },
      include: {
        producto: true,
        unidad: true,
        documento: {
          include: {
            bodega_documento_bodegaorigenidTobodega: true,
          },
        },
      },
      take: 50,
    });

    const aplicaciones: LoteAplicacionDTO[] = aplicacionesRaw.map((item) => {
      const doc = item.documento;
      const bodega =
        doc?.bodega_documento_bodegaorigenidTobodega?.nombre ?? null;

      const cantidadNum = Number(item.cantidad) || 0;
      const unidad = item.unidad?.abreviatura ?? "";

      return {
        id: item.id,
        documentoId: doc?.id ?? "",
        documentoCodigo: doc?.consecutivo ?? doc?.id ?? "",
        tipo: (doc?.tipo ?? "SALIDA") as MovimientoTipo,
        fecha: doc?.fecha ? doc.fecha.toISOString() : null,
        bodega,
        producto: item.producto?.nombre ?? "",
        cantidad: `${cantidadNum} ${unidad}`.trim(),
        unidad,
      };
    });

    const aplicacionesCount = aplicaciones.length;

    const loteFront: LoteResumenDTO = {
      id: lote.id,
      codigo: lote.codigo,
      finca: lote.finca?.nombre ?? "",
      cultivo: lote.cultivo?.nombre ?? "",
      area,
      estado: estadoFront,
      aplicacionesCount,
    };

    return {
      lote: loteFront,
      aplicaciones,
    };
  },
};
