// src/services/inicioService.ts
import prisma from "../prisma";

// ------------------------------
// Tipos de respuesta (opcional, solo para ayudarte)
// ------------------------------
type SolicitudDashboardItem = {
  id: string;
  codigo: string;
  cliente: string;
  bodega: string;
  productos: string; // "5 productos"
  fecha: string;
  estado: string | null;
};

type MovimientoDashboardItem = {
  id: string;
  codigo: string;
  tipo: string;
  productos: string; // "3 productos"
  fecha: string;
};

type BodegueroDashboard = {
  resumen: {
    pendientes: number;
    stockBajo: number;
  };
  solicitudesPorAtender: SolicitudDashboardItem[];
  movimientosDelDia: MovimientoDashboardItem[];
};

// ------------------------------
// Servicio de inicio
// ------------------------------
export const inicioService = {
  // ==========================================
  // DASHBOARD BODEGUERO
  // ==========================================
  async getBodegueroDashboard(): Promise<BodegueroDashboard> {
    // 1) Total de solicitudes pendientes
    const pendientes = await prisma.solicitud.count({
      where: { estado: "PENDIENTE" },
    });

    // 2) Productos con stock bajo
    //    Por ahora NO tenemos tabla de existencias, así que solo contamos productos.
    //    Más adelante, cuando definamos stock por bodega, aquí ponemos el filtro real.
    const stockBajo = await prisma.producto.count();

    // 3) Solicitudes recientes (para la tarjeta "Solicitudes por Atender")
    const solicitudes = await prisma.solicitud.findMany({
      orderBy: { fecha: "desc" },
      take: 5,
      select: {
        id: true,
        fecha: true,
        estado: true,
        bodega: { select: { nombre: true } },
        usuario_solicitud_solicitanteidTousuario: {
          select: { nombre: true },
        },
        solicitud_item: {
          select: { id: true },
        },
      },
    });

    const solicitudesPorAtender: SolicitudDashboardItem[] = solicitudes.map(
      (s) => {
        const fechaStr = s.fecha
          ? s.fecha.toISOString().split("T")[0]
          : "";

        return {
          id: s.id,
          // De momento usamos el UUID como "código".
          // Más adelante podemos generar algo tipo "SOL-2025-0001".
          codigo: s.id,
          cliente:
            s.usuario_solicitud_solicitanteidTousuario?.nombre ?? "—",
          bodega: s.bodega?.nombre ?? "—",
          productos: `${s.solicitud_item.length} productos`,
          fecha: fechaStr,
          estado: s.estado ?? null,
        };
      }
    );

    // 4) Movimientos del día (documentos de hoy: ingresos/salidas/transferencias)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const documentos = await prisma.documento.findMany({
      where: {
        fecha: {
          gte: hoy,
        },
      },
      orderBy: { fecha: "desc" },
      take: 5,
      select: {
        id: true,
        fecha: true,
        tipo: true,
        consecutivo: true,
        documento_item: {
          select: { id: true },
        },
      },
    });

    const movimientosDelDia: MovimientoDashboardItem[] = documentos.map(
      (d) => {
        const fechaStr = d.fecha
          ? d.fecha.toISOString().replace("T", " ").slice(0, 16)
          : "";

        return {
          id: d.id,
          codigo: d.consecutivo ?? d.id,
          tipo: d.tipo, // "INGRESO" | "SALIDA" | "TRANSFERENCIA" | etc
          productos: `${d.documento_item.length} productos`,
          fecha: fechaStr,
        };
      }
    );

    return {
      resumen: {
        pendientes,
        stockBajo,
      },
      solicitudesPorAtender,
      movimientosDelDia,
    };
  },

  // ==========================================
  // DASHBOARD SOLICITANTE (stub por ahora)
  // ==========================================
  async getSolicitanteDashboard() {
    // Lo llenamos luego con consultas reales.
    return {
      mensaje:
        "Dashboard de SOLICITANTE aún no está implementado con datos reales.",
    };
  },

  // ==========================================
  // DASHBOARD ADMIN (stub por ahora)
  // ==========================================
  async getAdminDashboard() {
    // Igual, luego sacamos info real de documento, producto, etc.
    return {
      mensaje:
        "Dashboard de ADMIN aún no está implementado con datos reales.",
    };
  },
};
