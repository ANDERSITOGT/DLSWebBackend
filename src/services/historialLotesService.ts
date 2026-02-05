import prisma from "../prisma";
import PDFDocument from "pdfkit";

// ==========================================
// Tipos de Datos (DTOs)
// ==========================================

export type LoteBasicDTO = {
  id: string;
  codigo: string;
  cultivo: string;
  area: string;
  estado: "ACTIVO" | "INACTIVO";
  encargados: string[];
  costoTotal: number;
  fechaSiembra: Date | null; // 👈 NUEVO: Fecha de siembra
  conteoAplicaciones: number; // 👈 NUEVO: Cantidad de aplicaciones
};

export type FincaGroupDTO = {
  fincaId: string;
  nombreFinca: string;
  lotesActivos: LoteBasicDTO[];
  lotesCerrados: LoteBasicDTO[];
};

export type AplicacionHistorialDTO = {
  id: string;
  fecha: Date | null;
  documentoId: string;
  documentoCodigo: string;
  tipo: string;
  producto: string;
  cantidad: number;
  unidad: string;
  costoEstimado: number;
};

export type LoteDetalleFullDTO = {
  info: LoteBasicDTO & { finca: string };
  historial: AplicacionHistorialDTO[];
};

// ==========================================
// SERVICIO PRINCIPAL
// ==========================================
export const lotesService = {

  // 1. OBTENER DASHBOARD AGRUPADO
  async getLotesDashboard(usuario: { id: string; rol: string }): Promise<FincaGroupDTO[]> {
    
    const whereClause: any = {};
    if (usuario.rol === "SOLICITANTE") {
      whereClause.encargados = { some: { usuarioid: usuario.id } };
    }

    const lotesRaw = await prisma.lote.findMany({
      where: whereClause,
      include: {
        finca: true,
        cultivo: true,
        encargados: { include: { usuario: true } },
        documento_item: {
          where: { documento: { tipo: "SALIDA", estado: "APROBADO" } },
          // 👈 IMPORTANTE: Traemos documentoid para contar únicos
          select: { cantidad: true, costounit: true, documentoid: true } 
        }
      },
      orderBy: { codigo: "asc" }
    });

    const agrupado: Record<string, FincaGroupDTO> = {};

    for (const lote of lotesRaw) {
      const fincaId = lote.fincaid;
      
      if (!agrupado[fincaId]) {
        agrupado[fincaId] = {
          fincaId: lote.fincaid,
          nombreFinca: lote.finca.nombre,
          lotesActivos: [],
          lotesCerrados: []
        };
      }

      // 1. Calcular Costo
      const costoTotal = lote.documento_item.reduce((acc, item) => {
        const cant = Number(item.cantidad || 0);
        const costo = Number(item.costounit || 0);
        return acc + (cant * costo);
      }, 0);

      // 2. Calcular Conteo de Aplicaciones (Documentos Únicos) 👈 NUEVO
      // Usamos un Set para contar IDs de documentos únicos, no items individuales
      const uniqueDocs = new Set(lote.documento_item.map(i => i.documentoid));
      const conteoApps = uniqueDocs.size;

      // 3. Formatear Área
      let areaStr = "-";
      if (lote.areamanzanas) areaStr = `${Number(lote.areamanzanas)} mz`;
      else if (lote.areahectareas) areaStr = `${Number(lote.areahectareas)} ha`;

      const loteDTO: LoteBasicDTO = {
        id: lote.id,
        codigo: lote.codigo,
        cultivo: lote.cultivo.nombre,
        area: areaStr,
        estado: lote.estado === "ABIERTO" ? "ACTIVO" : "INACTIVO",
        encargados: lote.encargados.map(e => e.usuario.nombre.split(" ")[0]),
        costoTotal: costoTotal,
        fechaSiembra: lote.fechasiembra, // 👈 NUEVO
        conteoAplicaciones: conteoApps   // 👈 NUEVO
      };

      if (loteDTO.estado === "ACTIVO") {
        agrupado[fincaId].lotesActivos.push(loteDTO);
      } else {
        agrupado[fincaId].lotesCerrados.push(loteDTO);
      }
    }

    return Object.values(agrupado).sort((a, b) => a.nombreFinca.localeCompare(b.nombreFinca));
  },

  // 2. DETALLE DE LOTE CON HISTORIAL Y COSTOS
  async getDetalleLoteFull(loteId: string, usuario: { id: string; rol: string }): Promise<LoteDetalleFullDTO> {
    // ... (El resto de funciones se mantienen igual, solo actualiza los tipos si TypeScript se queja)
    
    if (usuario.rol === "SOLICITANTE") {
      const permiso = await prisma.lote_encargado.findFirst({
        where: { loteid: loteId, usuarioid: usuario.id }
      });
      if (!permiso) throw new Error("No tienes acceso a este lote.");
    }

    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
      include: {
        finca: true,
        cultivo: true,
        encargados: { include: { usuario: true } }
      }
    });

    if (!lote) throw new Error("Lote no encontrado");

    const salidas = await prisma.documento_item.findMany({
      where: {
        loteid: loteId,
        documento: { tipo: "SALIDA", estado: "APROBADO" }
      },
      include: {
        documento: true,
        producto: { include: { unidad: true } }
      },
      orderBy: { documento: { fecha: "desc" } }
    });

    let costoTotalAcumulado = 0;
    // Set para contar aplicaciones en el detalle también
    const uniqueDocs = new Set();

    const historial: AplicacionHistorialDTO[] = salidas.map((item) => {
      const cantidad = Number(item.cantidad);
      const costoUnit = Number(item.costounit || 0);
      const costoAplicacion = cantidad * costoUnit;

      costoTotalAcumulado += costoAplicacion;
      uniqueDocs.add(item.documentoid);

      return {
        id: item.id,
        fecha: item.documento.fecha,
        documentoId: item.documentoid,
        documentoCodigo: item.documento.consecutivo || "S/N",
        tipo: item.documento.tipo,
        producto: item.producto.nombre,
        cantidad: cantidad,
        unidad: item.producto.unidad.abreviatura,
        costoEstimado: costoAplicacion
      };
    });

    let areaStr = "-";
    if (lote.areamanzanas) areaStr = `${Number(lote.areamanzanas)} mz`;

    return {
      info: {
        id: lote.id,
        codigo: lote.codigo,
        finca: lote.finca.nombre,
        cultivo: lote.cultivo.nombre,
        area: areaStr,
        estado: lote.estado === "ABIERTO" ? "ACTIVO" : "INACTIVO",
        encargados: lote.encargados.map(e => e.usuario.nombre),
        costoTotal: costoTotalAcumulado,
        fechaSiembra: lote.fechasiembra, // 👈 Pasamos fecha
        conteoAplicaciones: uniqueDocs.size // 👈 Pasamos conteo
      },
      historial
    };
  },

  // ... (exportLotePDF se mantiene igual o puedes agregar la fecha si quieres)
  async exportLotePDF(loteId: string, usuario: { id: string; rol: string }): Promise<{ filename: string; mime: string; content: Buffer }> {
    const data = await this.getDetalleLoteFull(loteId, usuario);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve({ 
        filename: `Lote_${data.info.codigo}.pdf`, 
        mime: "application/pdf", 
        content: Buffer.concat(chunks) 
      }));
      doc.on("error", reject);

      doc.fontSize(18).text(`Historial de Lote: ${data.info.codigo}`, { align: "center" });
      doc.moveDown();
      doc.fontSize(10);
      doc.text(`Finca: ${data.info.finca}`);
      doc.text(`Cultivo: ${data.info.cultivo}`);
      // Agregar fecha de siembra al PDF si existe
      if(data.info.fechaSiembra) {
         doc.text(`Fecha Siembra: ${data.info.fechaSiembra.toLocaleDateString()}`);
      }
      doc.text(`Costo Total Invertido: Q${data.info.costoTotal.toFixed(2)}`);
      doc.moveDown();

      doc.fontSize(10).font("Helvetica-Bold");
      doc.text("Fecha", 40, doc.y, { width: 80 });
      doc.text("Producto", 120, doc.y, { width: 200 });
      doc.text("Cant.", 320, doc.y, { width: 60 });
      doc.text("Costo", 380, doc.y, { width: 80, align: "right" });
      doc.moveDown();
      doc.font("Helvetica");

      data.historial.forEach((h) => {
        const fecha = h.fecha ? h.fecha.toLocaleDateString() : "-";
        const y = doc.y;
        doc.text(fecha, 40, y, { width: 80 });
        doc.text(h.producto, 120, y, { width: 200 });
        doc.text(`${h.cantidad} ${h.unidad}`, 320, y, { width: 60 });
        doc.text(`Q${h.costoEstimado.toFixed(2)}`, 380, y, { width: 80, align: "right" });
        doc.moveDown(0.5);
      });
      doc.end();
    });
  }
};