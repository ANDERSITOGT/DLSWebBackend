// src/services/inicioService.ts
import prisma from "../prisma";

export const inicioService = {
  // =========================================================
  // DASHBOARD BODEGUERO
  // =========================================================
  async getBodegueroDashboard() {
    // ---------------- Resumen ----------------
    const pendientes = await prisma.solicitud.count({
      where: {
        estado: "PENDIENTE",
      },
    });

    // De momento no tenemos campo de stock real, usamos un valor fijo
    // más adelante esto vendrá de una vista de existencias.
    const stockBajo = 5;

    // ---------------- Solicitudes por atender ----------------
    const solicitudesPorAtenderRaw = await prisma.solicitud.findMany({
      where: {
        estado: {
          in: ["PENDIENTE", "APROBADA"],
        },
      },
      orderBy: { fecha: "desc" },
      take: 5,
      select: {
        id: true,
        fecha: true,
        estado: true,
        bodega: {
          select: { nombre: true },
        },
        usuario_solicitud_solicitanteidTousuario: {
          select: { nombre: true },
        },
        solicitud_item: {
          select: { id: true },
        },
      },
    });

    const solicitudesPorAtender = solicitudesPorAtenderRaw.map((s) => ({
      id: s.id,
      codigo: s.id, // luego podremos usar el consecutivo del documento de salida
      cliente: s.usuario_solicitud_solicitanteidTousuario?.nombre ?? "Sin nombre",
      bodega: s.bodega?.nombre ?? "Sin bodega",
      productos: `${s.solicitud_item.length} productos`,
      fecha: s.fecha ? s.fecha.toISOString() : null,
      estado: s.estado,
    }));

    // ---------------- Movimientos del día ----------------
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const movimientosDelDiaRaw = await prisma.documento.findMany({
      where: {
        fecha: { gte: hoy },
        tipo: {
          in: ["INGRESO", "SALIDA", "TRANSFERENCIA"],
        },
      },
      orderBy: { fecha: "desc" },
      take: 5,
      select: {
        id: true,
        fecha: true,
        tipo: true,
        documento_item: {
          select: { id: true },
        },
      },
    });

    const movimientosDelDia = movimientosDelDiaRaw.map((m) => ({
      id: m.id,
      codigo: m.id,
      tipo: m.tipo,
      productos: `${m.documento_item.length} productos`,
      fecha: m.fecha ? m.fecha.toISOString() : null,
    }));

    return {
      resumen: {
        pendientes,
        stockBajo,
      },
      solicitudesPorAtender,
      movimientosDelDia,
    };
  },

  // =========================================================
  // DASHBOARD SOLICITANTE
  // =========================================================
  async getSolicitanteDashboard() {
    // TODO: más adelante tomar el solicitante de la sesión / token
    // const solicitanteId = "...";

    const hoy = new Date();

    // Inicio de semana (lunes)
    const inicioSemana = new Date(hoy);
    const diff = (inicioSemana.getDay() + 6) % 7; // 0=domingo, queremos lunes
    inicioSemana.setDate(inicioSemana.getDate() - diff);
    inicioSemana.setHours(0, 0, 0, 0);

    // ---------------- Resumen ----------------
    const pendientes = await prisma.solicitud.count({
      where: {
        estado: "PENDIENTE",
        // solicitanteid: solicitanteId,
      },
    });

    const aprobadas = await prisma.solicitud.count({
      where: {
        estado: "APROBADA",
        // solicitanteid: solicitanteId,
      },
    });

    const estaSemana = await prisma.solicitud.count({
      where: {
        fecha: { gte: inicioSemana },
        // solicitanteid: solicitanteId,
      },
    });

    // ---------------- En proceso ----------------
    const enProcesoRaw = await prisma.solicitud.findMany({
      where: {
        estado: { in: ["PENDIENTE", "APROBADA"] },
        // solicitanteid: solicitanteId,
      },
      orderBy: { fecha: "desc" },
      take: 5,
      select: {
        id: true,
        fecha: true,
        estado: true,
        bodega: {
          select: { nombre: true },
        },
        solicitud_item: {
          select: { id: true },
        },
      },
    });

    const enProceso = enProcesoRaw.map((s) => ({
      id: s.id,
      codigo: s.id,
      bodega: s.bodega?.nombre ?? "Sin bodega",
      productos: `${s.solicitud_item.length} productos`,
      fecha: s.fecha ? s.fecha.toISOString() : null,
      estado: s.estado,
    }));

    // ---------------- Historial ----------------
    const historialRaw = await prisma.solicitud.findMany({
      where: {
        estado: { in: ["ENTREGADA", "RECHAZADA"] },
        // solicitanteid: solicitanteId,
      },
      orderBy: { fecha: "desc" },
      take: 5,
      select: {
        id: true,
        fecha: true,
        estado: true,
        bodega: {
          select: { nombre: true },
        },
        solicitud_item: {
          select: { id: true },
        },
      },
    });

    const historial = historialRaw.map((s) => ({
      id: s.id,
      codigo: s.id,
      bodega: s.bodega?.nombre ?? "Sin bodega",
      productos: `${s.solicitud_item.length} productos`,
      fecha: s.fecha ? s.fecha.toISOString() : null,
      estado: s.estado,
    }));

    return {
      resumen: {
        pendientes,
        aprobadas,
        estaSemana,
      },
      enProceso,
      historial,
    };
  },

  // =========================================================
  // (Opcional) DASHBOARD ADMIN
  // Por ahora solo devolvemos algunos contadores básicos.
  // Lo usaremos más adelante cuando conectemos el inicio de ADMIN.
  // =========================================================
  async getAdminDashboard() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const movimientosHoy = await prisma.documento.count({
      where: {
        fecha: { gte: hoy },
      },
    });

    const stockBajo = 5; // placeholder

    const solicitudesActivas = await prisma.solicitud.count({
      where: {
        estado: {
          in: ["PENDIENTE", "APROBADA"],
        },
      },
    });

    // Más adelante esto vendrá de un cálculo real de inventario
    const valorInventarioEstimado = 2500000; // Q2.5M

    return {
      resumen: {
        movimientosHoy,
        stockBajo,
        solicitudes: solicitudesActivas,
        valorInventario: valorInventarioEstimado,
      },
    };
  },
};
