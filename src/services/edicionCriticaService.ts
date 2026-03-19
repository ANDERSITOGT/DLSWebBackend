import prisma from "../prisma";

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
export const edicionCriticaService = {
  // ========================================================
  // 1. BÚSQUEDA AVANZADA Y PAGINADA
  // ========================================================
  async buscarDocumentos(filtros: any, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const whereDocumento: any = {};
    
    if (filtros.documentoId) {
      whereDocumento.id = { contains: filtros.documentoId, mode: "insensitive" };
    }
    if (filtros.tipo) {
      whereDocumento.tipo = filtros.tipo;
    }
    if (filtros.fechaInicio && filtros.fechaFin) {
      whereDocumento.fecha = {
        gte: new Date(filtros.fechaInicio),
        lte: new Date(filtros.fechaFin),
      };
    }

    const whereItems: any = {};
    if (filtros.productoId) whereItems.productoid = filtros.productoId;
    if (filtros.fincaId) whereItems.lote = { fincaid: filtros.fincaId };
    if (filtros.loteId) whereItems.loteid = filtros.loteId;

    if (Object.keys(whereItems).length > 0) {
      whereDocumento.documento_item = { some: whereItems };
    }

    const documentos = await prisma.documento.findMany({
      where: whereDocumento,
      skip,
      take: limit,
      orderBy: { fecha: "desc" },
      include: {
        usuario_documento_creadoridTousuario: { select: { nombre: true } },
        bodega_documento_bodegadestinoidTobodega: { select: { nombre: true } },
        bodega_documento_bodegaorigenidTobodega: { select: { nombre: true } },
        documento_item: {
          where: Object.keys(whereItems).length > 0 ? whereItems : undefined,
          include: {
            producto: { select: { nombre: true, codigo: true } },
            lote: {
              select: { 
                codigo: true, 
                finca: { select: { nombre: true } } 
              }
            },
            unidad: { select: { id: true, abreviatura: true } } 
          }
        }
      }
    });

    const total = await prisma.documento.count({ where: whereDocumento });

    return {
      data: documentos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  // ========================================================
  // 2. EDICIÓN CRÍTICA Y AUDITORÍA (Modo Dios)
  // ========================================================
  async ejecutarEdicionCritica(
    documentoId: string, 
    usuarioId: string, 
    justificacion: string, 
    cambios: { documento: any, itemsModificados: any[] }
  ) {
    return await prisma.$transaction(async (tx) => {
      
      // 1. Tomar la "Fotografía" del Estado Anterior
      const estadoAnterior = await tx.documento.findUnique({
        where: { id: documentoId },
        include: { documento_item: true }
      });

      if (!estadoAnterior) throw new Error("Documento no encontrado");

      // 2. Aplicar cambios al Documento (Cabecera)
      if (cambios.documento && Object.keys(cambios.documento).length > 0) {
        
        // Clonamos los datos para no mutar el objeto original directamente
        const dataActualizar = { ...cambios.documento };

        // Sincronizamos la fecha de creación con la nueva fecha asignada
        if (dataActualizar.fecha) {
            dataActualizar.createdat = dataActualizar.fecha;
        }

        await tx.documento.update({
          where: { id: documentoId },
          data: dataActualizar
        });
      }

      // 3. Aplicar cambios a los Items
      for (const itemModificado of cambios.itemsModificados) {
        
        // Validación de seguridad estricta para evitar crash
        if (!itemModificado.unidadid) {
            throw new Error(`Error Crítico: No se detectó la unidad de medida para el producto seleccionado (ID Producto: ${itemModificado.productoid}).`);
        }

        if (itemModificado.id) {
          // Actualizar item existente
          await tx.documento_item.update({
            where: { id: itemModificado.id },
            data: {
              cantidad: itemModificado.cantidad,
              productoid: itemModificado.productoid,
              unidadid: itemModificado.unidadid, 
              loteid: itemModificado.loteid,
              notas: itemModificado.notas
            }
          });
        } else {
          // Crear nuevo item en el documento histórico
          await tx.documento_item.create({
            data: {
              documentoid: documentoId,
              productoid: itemModificado.productoid,
              unidadid: itemModificado.unidadid,
              loteid: itemModificado.loteid,
              cantidad: itemModificado.cantidad,
              notas: itemModificado.notas
            }
          });
        }
      }

      // 4. Tomar la "Fotografía" del Estado Nuevo
      const estadoNuevo = await tx.documento.findUnique({
        where: { id: documentoId },
        include: { documento_item: true }
      });

      // 5. Registrar en Auditoría
      const payloadAuditoria = {
        justificacion: justificacion,
        antes: estadoAnterior,
        despues: estadoNuevo
      };

      await tx.auditoria.create({
        data: {
          usuarioid: usuarioId,
          entidad: "documento",
          entidadid: documentoId,
          accion: "EDICION_CRITICA",
          payload: payloadAuditoria,
          ip: "Sistema Web" 
        }
      });

      return estadoNuevo;
    });
  }
};