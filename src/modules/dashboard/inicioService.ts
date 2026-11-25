// src/modules/dashboard/inicioService.ts
// @deprecated Este dashboard legacy sera retirado. La fuente oficial es /api/dashboard.
// Solo se conserva getSolicitanteDashboard hasta que producto cierre la migracion
// del frontend (que aun consume /api/inicio/solicitante).
import prisma from "../../core/prisma";
import {
  SOLICITUD_APROBADA,
  SOLICITUD_ENTREGADA,
  SOLICITUD_PENDIENTE,
  SOLICITUD_RECHAZADA,
} from "../../core/constants";
import { inicioDelDiaGT } from "../../core/tiempo";

function inicioDeHoy() {
  // Medianoche en hora Guatemala, no en la hora del servidor.
  return inicioDelDiaGT(new Date());
}

function inicioDeSemanaActual() {
  const hoy = new Date();
  const inicio = inicioDeHoy();
  // Día de la semana en Guatemala (0 = domingo).
  // Se calcula con la clave de día GT para no depender de la TZ del servidor.
  const clave = new Date(hoy.getTime() - 6 * 60 * 60 * 1000);
  const diaSemanaGT = clave.getUTCDay();
  const diff = (diaSemanaGT + 6) % 7; // lunes como inicio de semana
  return new Date(inicio.getTime() - diff * 24 * 60 * 60 * 1000);
}

export const inicioService = {
  // ========================================
  // SOLICITANTE  (@deprecated -> migrar a /api/dashboard?modulo=BODEGA)
  // ========================================
  async getSolicitanteDashboard() {
    // Nota: este dashboard legacy NO filtra por usuario. Se mantiene
    // temporalmente por compatibilidad; el dashboard nuevo ya aplica filtrado por rol.
    const inicioSemana = inicioDeSemanaActual();

    // --------- Resumen ---------
    const pendientes = await prisma.solicitud.count({
      where: { estado: SOLICITUD_PENDIENTE },
    });

    const aprobadas = await prisma.solicitud.count({
      where: { estado: SOLICITUD_APROBADA },
    });

    const estaSemana = await prisma.solicitud.count({
      where: {
        fecha: { gte: inicioSemana },
      },
    });

    // --------- En Proceso ---------
    const enProcesoRaw = await prisma.solicitud.findMany({
      where: {
        estado: { in: [SOLICITUD_PENDIENTE, SOLICITUD_APROBADA] },
      },
      orderBy: { fecha: "desc" },
      take: 5,
      select: {
        id: true,
        fecha: true,
        estado: true,
        bodega: { select: { nombre: true } },
        solicitud_item: { select: { id: true } },
      },
    });

    const enProceso = enProcesoRaw.map((s) => ({
      id: s.id,
      codigo: s.id,
      bodega: s.bodega?.nombre ?? "Sin bodega",
      productos: `${s.solicitud_item.length} productos`,
      fecha: s.fecha ? s.fecha.toISOString() : null,
      estado: s.estado ?? SOLICITUD_PENDIENTE,
    }));

    // --------- Historial (ENTREGADAS / RECHAZADAS) ---------
    const historialRaw = await prisma.solicitud.findMany({
      where: {
        estado: { in: [SOLICITUD_ENTREGADA, SOLICITUD_RECHAZADA] },
      },
      orderBy: { fecha: "desc" },
      take: 5,
      select: {
        id: true,
        fecha: true,
        estado: true,
        bodega: { select: { nombre: true } },
        solicitud_item: { select: { id: true } },
      },
    });

    const historial = historialRaw.map((s) => ({
      id: s.id,
      codigo: s.id,
      bodega: s.bodega?.nombre ?? "Sin bodega",
      productos: `${s.solicitud_item.length} productos`,
      fecha: s.fecha ? s.fecha.toISOString() : null,
      estado: s.estado ?? SOLICITUD_ENTREGADA,
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
};
