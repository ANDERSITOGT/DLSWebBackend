import { Router, Response } from "express";
import prisma from "../prisma";
import { authenticateToken, AuthRequest } from "../middlewares/auth";
import solicitudesService from "../services/solicitudesService";

const router = Router();

// ===============================
// GET /api/solicitudes
// ===============================
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // 👇 1. CAMBIO: Ahora capturamos también 'tipo' de la URL
    const { estado, tipo } = req.query;
    
    const usuario = req.user; 

    const data = await solicitudesService.getSolicitudes({
      estado: estado as any,
      // 👇 2. CAMBIO: Pasamos el tipo al servicio
      tipo: tipo as any, 
      usuario: usuario ? { id: usuario.id, rol: usuario.rol } : undefined,
    });
    
    res.json({ solicitudes: data }); 
  } catch (error) {
    console.error("Error en GET /api/solicitudes:", error);
    res.status(500).json({ message: "Error al obtener solicitudes" });
  }
});

// ===============================
// GET /api/solicitudes/:id
// ===============================
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const data = await solicitudesService.getDetalleSolicitud(id);
    
    // Seguridad: Solicitante solo ve lo suyo
    if (req.user?.rol === "SOLICITANTE" && data.solicitante.id !== req.user.id) {
        return res.status(403).json({ message: "No tienes permiso para ver esta solicitud." });
    }

    res.json(data);
  } catch (error) {
    console.error("Error en GET /api/solicitudes/:id:", error);
    res.status(500).json({ message: "Error al obtener detalle" });
  }
});

// ===============================
// POST /api/solicitudes
// ===============================
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  console.log("📥 Recibiendo solicitud:", req.body);

  try {
    const { bodegaId, items, solicitanteId: bodySolicitanteId, tipo = "DESPACHO", solicitudOrigenId } = req.body;
    
    const user = req.user;
    const finalSolicitanteId = user?.id ?? bodySolicitanteId;

    if (!finalSolicitanteId) {
        return res.status(400).json({ message: "No se identificó al solicitante (Error de sesión)" });
    }
    
    if (!bodegaId || !items || items.length === 0) {
        return res.status(400).json({ message: "Faltan datos obligatorios (bodega o items)." });
    }

    const nuevaSolicitud = await prisma.$transaction(async (tx) => {
      
      // Validación Unicidad Devolución
      if (tipo === "DEVOLUCION" && solicitudOrigenId) {
          const yaDevuelta = await tx.solicitud.findFirst({
              where: { 
                  solicitud_origen_id: solicitudOrigenId,
                  estado: { not: "RECHAZADA" } 
              }
          });

          if (yaDevuelta) {
              throw new Error(`Error: La solicitud ${solicitudOrigenId} ya tiene una devolución activa (${yaDevuelta.id}).`);
          }
      }

      // Validación Stock (Solo Despacho)
      if (tipo === "DESPACHO") {
        for (const item of items) {
            const ingresos = await tx.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: item.productoId, documento: { tipo: "INGRESO", estado: "APROBADO" } } });
            const salidas = await tx.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: item.productoId, documento: { tipo: "SALIDA", estado: "APROBADO" } } });
            const ajustes = await tx.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: item.productoId, documento: { tipo: "AJUSTE", estado: "APROBADO" } } });
            const devInternas = await tx.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: item.productoId, documento: { tipo: "DEVOLUCION", estado: "APROBADO", proveedorid: null } } });
            const devExternas = await tx.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: item.productoId, documento: { tipo: "DEVOLUCION", estado: "APROBADO", NOT: { proveedorid: null } } } });

            const stockFisico = 
                ((Number(ingresos._sum.cantidad) || 0) + (Number(devInternas._sum.cantidad) || 0) + (Number(ajustes._sum.cantidad) || 0)) - 
                ((Number(salidas._sum.cantidad) || 0) + (Number(devExternas._sum.cantidad) || 0));

            const comprometido = await tx.solicitud_item.aggregate({
                _sum: { cantidad: true },
                where: {
                    productoid: item.productoId,
                    solicitud: {
                        estado: { in: ["PENDIENTE", "APROBADA"] },
                        tipo: "DESPACHO" 
                    }
                }
            });

            const stockComprometido = Number(comprometido._sum.cantidad) || 0;
            const disponibleReal = stockFisico - stockComprometido;
            const cantidadSolicitada = Number(item.cantidad);

            if (cantidadSolicitada > disponibleReal) {
                const prodInfo = await tx.producto.findUnique({ where: { id: item.productoId } });
                throw new Error(`Stock insuficiente para "${prodInfo?.nombre}". Físico: ${stockFisico}, Comprometido: ${stockComprometido}, Disponible: ${disponibleReal}`);
            }
        }
      }

      // Consecutivo
      const anioActual = new Date().getFullYear();
      let nuevoCorrelativo = 1;

      const contador = await tx.consecutivo.findUnique({
          where: { tipo_anio: { tipo: "SOLICITUD", anio: anioActual } }
      });

      if (contador) {
          const actualizado = await tx.consecutivo.update({
              where: { id: contador.id },
              data: { ultimo: { increment: 1 } }
          });
          nuevoCorrelativo = actualizado.ultimo || 1;
      } else {
          await tx.consecutivo.create({
              data: { tipo: "SOLICITUD", anio: anioActual, ultimo: 1, prefijo: "SOL" }
          });
          nuevoCorrelativo = 1;
      }

      const codigoGenerado = `SOL-${anioActual}-${nuevoCorrelativo.toString().padStart(4, '0')}`;

      const solicitud = await tx.solicitud.create({
        data: {
          id: codigoGenerado,
          solicitanteid: finalSolicitanteId,
          bodegaid: bodegaId,
          estado: "PENDIENTE",
          fecha: new Date(),
          tipo: tipo,
          solicitud_origen_id: solicitudOrigenId || null 
        }
      });

      for (const item of items) {
        const prod = await tx.producto.findUnique({
              where: { id: item.productoId },
              select: { unidadid: true }
        });

        if (!prod) throw new Error(`Producto ${item.productoId} no encontrado`);

        await tx.solicitud_item.create({
          data: {
            solicitudid: solicitud.id,
            productoid: item.productoId,
            cantidad: item.cantidad,
            unidadid: prod.unidadid,
            notas: item.notas || null,
            loteid: item.loteId || null 
          }
        });
      }
      return solicitud;
    });

    console.log("✅ Solicitud creada:", nuevaSolicitud.id);
    res.status(201).json({ ok: true, solicitud: nuevaSolicitud });

  } catch (error: any) {
    console.error("❌ Error al guardar solicitud:", error);
    res.status(400).json({ message: error.message || "Error interno al guardar" });
  }
});

// ===============================
// PATCH ESTADO
// ===============================
router.patch("/:id/estado", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { estado } = req.body; 
    const aprobadorId = req.user?.id; 

    const data = await solicitudesService.actualizarEstadoSolicitud(
      id,
      estado,
      aprobadorId 
    );
    res.json(data);
  } catch (error) {
    console.error("Error en PATCH /api/solicitudes/:id/estado:", error);
    res.status(500).json({ message: "Error al actualizar estado" });
  }
});

// ===============================
// EXPORTAR
// ===============================
router.get("/:id/export", async (req, res) => {
  try {
    const id = req.params.id;
    const { filename, mime, content } = await solicitudesService.exportSolicitudDetallePDF(id);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error("Error en GET /api/solicitudes/:id/export:", error);
    res.status(500).send("Error al exportar PDF");
  }
});

// ===============================
// ENTREGAR (GENERAR SALIDA/DEVOLUCION)
// ===============================
router.post("/:id/entregar", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const userId = req.user?.id; 

    if (!userId) {
        return res.status(401).json({ message: "No se pudo identificar al usuario que realiza la entrega." });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitud.findUnique({
        where: { id },
        include: { solicitud_item: true }
      });

      if (!solicitud) throw new Error("Solicitud no encontrada");
      
      if (solicitud.estado === "ENTREGADA" || solicitud.estado === "RECHAZADA") {
          throw new Error(`La solicitud ya está en estado ${solicitud.estado} y no se puede procesar nuevamente.`);
      }

      const esDespacho = solicitud.tipo === "DESPACHO";
      const tipoDocumento = esDespacho ? "SALIDA" : "DEVOLUCION";

      // Consecutivo Documento
      const anioActual = new Date().getFullYear();
      let nuevoCorrelativo = 1;
      const prefijo = esDespacho ? "SAL" : "DEV";

      const contador = await tx.consecutivo.findUnique({
          where: { tipo_anio: { tipo: tipoDocumento, anio: anioActual } }
      });

      if (contador) {
          const actualizado = await tx.consecutivo.update({
              where: { id: contador.id },
              data: { ultimo: { increment: 1 } }
          });
          nuevoCorrelativo = actualizado.ultimo || 1;
      } else {
          await tx.consecutivo.create({
              data: { tipo: tipoDocumento, anio: anioActual, ultimo: 1, prefijo }
          });
          nuevoCorrelativo = 1;
      }
      
      const codigoDoc = `${prefijo}-${anioActual}-${nuevoCorrelativo.toString().padStart(4, '0')}`;

      // Documento Final
      const documento = await tx.documento.create({
        data: {
          tipo: tipoDocumento,
          estado: "APROBADO",
          fecha: new Date(),
          creadorid: userId,
          bodegaorigenid: esDespacho ? solicitud.bodegaid : null,   
          bodegadestinoid: !esDespacho ? solicitud.bodegaid : null, 
          solicitanteid: solicitud.solicitanteid,
          consecutivo: codigoDoc,
          observacion: `Generado automáticamente desde Solicitud ${solicitud.id} (${solicitud.tipo})`
        }
      });

      // Items Documento
      for (const item of solicitud.solicitud_item) {
        if (esDespacho) {
             // ... Validación de Stock igual que antes ...
             const ingresos = await tx.documento_item.aggregate({_sum:{cantidad:true}, where:{productoid:item.productoid, documento:{tipo:"INGRESO", estado:"APROBADO"}}});
             const salidas = await tx.documento_item.aggregate({_sum:{cantidad:true}, where:{productoid:item.productoid, documento:{tipo:"SALIDA", estado:"APROBADO"}}});
             const ajustes = await tx.documento_item.aggregate({_sum:{cantidad:true}, where:{productoid:item.productoid, documento:{tipo:"AJUSTE", estado:"APROBADO"}}});
             const devInternas = await tx.documento_item.aggregate({_sum:{cantidad:true}, where:{productoid:item.productoid, documento:{tipo:"DEVOLUCION", estado:"APROBADO", proveedorid:null}}});
             const devExternas = await tx.documento_item.aggregate({_sum:{cantidad:true}, where:{productoid:item.productoid, documento:{tipo:"DEVOLUCION", estado:"APROBADO", NOT:{proveedorid:null}}}});

             const stockFisicoAlMomento = 
               ((Number(ingresos._sum.cantidad)||0) + (Number(devInternas._sum.cantidad)||0) + (Number(ajustes._sum.cantidad)||0)) - 
               ((Number(salidas._sum.cantidad)||0) + (Number(devExternas._sum.cantidad)||0));
            
            if (stockFisicoAlMomento < Number(item.cantidad)) {
                const prod = await tx.producto.findUnique({ where: { id: item.productoid }, select: { nombre: true } });
                throw new Error(`¡ALTO! Error crítico. Stock insuficiente para "${prod?.nombre}". Hay: ${stockFisicoAlMomento}, Necesitas: ${item.cantidad}`);
            }
        }

        await tx.documento_item.create({
          data: {
            documentoid: documento.id,
            productoid: item.productoid,
            unidadid: item.unidadid,
            cantidad: item.cantidad,
            loteid: item.loteid,
            notas: item.notas
          }
        });
      }

      // Actualizar Estado Solicitud
      const solicitudActualizada = await tx.solicitud.update({
        where: { id },
        data: {
          estado: "ENTREGADA",
          aprobadorid: userId,
          documentosalidaid: documento.id
        }
      });

      return { solicitud: solicitudActualizada, documentoId: documento.id, codigoDoc };
    });

    res.json(resultado);

  } catch (error: any) {
    console.error("Error en POST /api/solicitudes/:id/entregar:", error);
    res.status(400).json({ message: error.message || "Error al procesar la entrega" });
  }
});

export default router;