// src/services/inicioService.ts
import prisma from "../prisma";

// Helpers
function inicioDeHoy() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy;
}

function inicioDeSemanaActual() {
  const hoy = new Date();
  const inicio = new Date(hoy);
  // 0 = domingo, queremos lunes como inicio de semana
  const diff = (inicio.getDay() + 6) % 7;
  inicio.setDate(inicio.getDate() - diff);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

export const inicioService = {
  // ========================================
  // BODEGUERO
  // ========================================
  async getBodegueroDashboard() {
    const hoy = inicioDeHoy();

    // Resumen
    const pendientes = await prisma.solicitud.count({
      where: { estado: "PENDIENTE" },
    });

    // Por ahora usamos el total de productos como "stock bajo" demo
    const stockBajo = await prisma.producto.count();

    // Solicitudes por atender (pendientes)
    const solicitudesRaw = await prisma.solicitud.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { fecha: "desc" },
      take: 5,
      select: {
        id: true,
        fecha: true,
        estado: true,
        bodega: { select: { nombre: true } },
        solicitud_item: { select: { id: true } },
        usuario_solicitud_solicitanteidTousuario: {
          select: { nombre: true },
        },
      },
    });

    const solicitudesPorAtender = solicitudesRaw.map((s) => ({
      id: s.id,
      codigo: s.id, // luego podremos usar un consecutivo real
      cliente:
        s.usuario_solicitud_solicitanteidTousuario?.nombre ??
        "Solicitante",
      bodega: s.bodega?.nombre ?? "Sin bodega",
      productos: `${s.solicitud_item.length} productos`,
      fecha: s.fecha ? s.fecha.toISOString() : null,
      estado: s.estado ?? "PENDIENTE",
    }));

    // Movimientos del día (documentos de hoy)
    const movimientosRaw = await prisma.documento.findMany({
      where: {
        fecha: { gte: hoy },
      },
      orderBy: { fecha: "desc" },
      take: 5,
      select: {
        id: true,
        fecha: true,
        tipo: true,
        documento_item: { select: { id: true } },
      },
    });

    const movimientosDelDia = movimientosRaw.map((d) => ({
      id: d.id,
      codigo: d.id,
      tipo: d.tipo,
      productos: `${d.documento_item.length} productos`,
      fecha: d.fecha ? d.fecha.toISOString() : null,
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

  // ========================================
  // SOLICITANTE
  // ========================================
  async getSolicitanteDashboard() {
    // En el futuro filtraremos por el usuario autenticado.
    const hoy = inicioDeHoy();
    const inicioSemana = inicioDeSemanaActual();

    // --------- Resumen ---------
    const pendientes = await prisma.solicitud.count({
      where: { estado: "PENDIENTE" },
    });

    const aprobadas = await prisma.solicitud.count({
      where: { estado: "APROBADA" },
    });

    const estaSemana = await prisma.solicitud.count({
      where: {
        fecha: { gte: inicioSemana },
      },
    });

    // --------- En Proceso ---------
    const enProcesoRaw = await prisma.solicitud.findMany({
      where: {
        estado: { in: ["PENDIENTE", "APROBADA"] },
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
      estado: s.estado ?? "PENDIENTE",
    }));

    // --------- Historial (ENTREGADAS / RECHAZADAS) ---------
    const historialRaw = await prisma.solicitud.findMany({
      where: {
        estado: { in: ["ENTREGADA", "RECHAZADA"] },
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
      estado: s.estado ?? "ENTREGADA",
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

  // ========================================
  // ADMIN
  // ========================================
  async getAdminDashboard() {
    const hoy = inicioDeHoy();

    // --------- Resumen superior ---------
    const movimientosHoy = await prisma.documento.count({
      where: { fecha: { gte: hoy } },
    });

    const stockBajo = await prisma.producto.count();

    const solicitudesActivas = await prisma.solicitud.count({
      where: {
        estado: { in: ["PENDIENTE", "APROBADA"] },
      },
    });

    // Valor inventario (demostración): suma de precioref de productos activos
    const productosConPrecio = await prisma.producto.findMany({
      where: { activo: true, precioref: { not: null } },
      select: { precioref: true },
    });

    let valorInventario = 0;
    for (const p of productosConPrecio) {
      // p.precioref es Decimal, convertimos a number
      valorInventario += Number(p.precioref);
    }

    // --------- Resumen del día ---------
    const ingresos = await prisma.documento.count({
      where: { fecha: { gte: hoy }, tipo: "INGRESO" },
    });

    const salidas = await prisma.documento.count({
      where: { fecha: { gte: hoy }, tipo: "SALIDA" },
    });

    const aprobadasHoy = await prisma.solicitud.count({
      where: { fecha: { gte: hoy }, estado: "APROBADA" },
    });

    // --------- Alertas ---------
    // 1) productos con "stock bajo" (demo: últimos creados)
    const productosStockBajo = await prisma.producto.findMany({
      take: 3,
      orderBy: { createdat: "desc" },
      select: { id: true, nombre: true },
    });

    // 2) productos / lotes próximos a vencer (demo usando fechacierre)
    const en30dias = new Date(hoy);
    en30dias.setDate(en30dias.getDate() + 30);

    const lotesProximos = await prisma.lote.findMany({
      where: {
        fechacierre: { not: null, gte: hoy, lte: en30dias },
      },
      take: 3,
      orderBy: { fechacierre: "asc" },
      select: {
        id: true,
        codigo: true,
        fechacierre: true,
        finca: { select: { nombre: true } },
      },
    });

    // 3) proveedores con pagos pendientes (demo: usamos todos los proveedores)
    const proveedoresConPagos = await prisma.proveedor.findMany({
      take: 3,
      orderBy: { createdat: "desc" },
      select: { id: true, nombre: true },
    });

    return {
      resumenTop: {
        movimientosHoy,
        stockBajo,
        solicitudesActivas,
        valorInventario,
      },
      resumenDelDia: {
        ingresos,
        salidas,
        aprobadas: aprobadasHoy,
      },
      alertas: {
        stockBajo: {
          cantidad: stockBajo,
          descripcion: "productos con stock bajo",
          ejemplos: productosStockBajo.map((p) => ({
            id: p.id,
            nombre: p.nombre,
          })),
        },
        productosProximosAVencer: {
          cantidad: lotesProximos.length,
          descripcion: "productos próximos a vencer (30 días)",
          ejemplos: lotesProximos.map((l) => ({
            id: l.id,
            codigo: l.codigo,
            finca: l.finca?.nombre ?? "",
            fechacierre: l.fechacierre,
          })),
        },
        proveedoresConPagosPendientes: {
          cantidad: proveedoresConPagos.length,
          descripcion: "proveedores con pagos pendientes (demo)",
          ejemplos: proveedoresConPagos.map((p) => ({
            id: p.id,
            nombre: p.nombre,
          })),
        },
      },
    };
  },
};
