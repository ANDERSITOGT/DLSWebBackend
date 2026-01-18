// src/routes/solicitudes.ts
import { Router, Response } from "express";
import prisma from "../prisma";
import { authenticateToken, AuthRequest } from "../middlewares/auth";
import solicitudesService from "../services/solicitudesService";

const router = Router();

// ===============================
// GET /api/solicitudes
// ===============================
router.get("/", async (req, res) => {
  try {
    const { estado, mis } = req.query;
    const user = (req as any).user;
    const solicitanteId = mis === "true" && user ? user.id : undefined;

    const data = await solicitudesService.getSolicitudes({
      estado: estado as any,
      solicitanteId,
    });
    res.json(data);
  } catch (error) {
    console.error("Error en GET /api/solicitudes:", error);
    res.status(500).json({ message: "Error al obtener solicitudes" });
  }
});

// ===============================
// GET /api/solicitudes/:id
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const data = await solicitudesService.getDetalleSolicitud(id);
    res.json(data);
  } catch (error) {
    console.error("Error en GET /api/solicitudes/:id:", error);
    res.status(500).json({ message: "Error al obtener detalle" });
  }
});

// ===============================
// POST /api/solicitudes
// CREAR NUEVA SOLICITUD (CON VALIDACIÓN DE STOCK REAL + COMPROMETIDO)
// ===============================
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  console.log("📥 Recibiendo solicitud:", req.body);

  try {
    const { bodegaId, items, solicitanteId: bodySolicitanteId } = req.body;
    
    // 1. Identificar Usuario
    const user = req.user;
    const finalSolicitanteId = user?.id ?? bodySolicitanteId;

    if (!finalSolicitanteId) {
        return res.status(400).json({ message: "No se identificó al solicitante (Error de sesión)" });
    }
    
    if (!bodegaId || !items || items.length === 0) {
        return res.status(400).json({ message: "Faltan datos obligatorios (bodega o items)." });
    }

    // 2. Transacción de Base de Datos
    const nuevaSolicitud = await prisma.$transaction(async (tx) => {
      
      // =======================================================
      // A. VALIDACIÓN DE STOCK DISPONIBLE (FÍSICO - COMPROMETIDO) 🔒
      // =======================================================
      for (const item of items) {
         // 1. Stock Físico (Entradas - Salidas)
         const entradas = await tx.documento_item.aggregate({
             _sum: { cantidad: true },
             where: {
                 productoid: item.productoId,
                 documento: { tipo: "INGRESO", estado: "APROBADO" }
             }
         });

         const salidas = await tx.documento_item.aggregate({
            _sum: { cantidad: true },
            where: {
                productoid: item.productoId,
                documento: { tipo: "SALIDA", estado: "APROBADO" }
            }
        });

        const stockFisico = (Number(entradas._sum.cantidad) || 0) - (Number(salidas._sum.cantidad) || 0);

        // 2. Stock Comprometido (Solicitudes Pendientes o Aprobadas que "apartan" producto)
        // No contamos RECHAZADA (obvio) ni ENTREGADA (porque esas ya generaron una Salida física y se restaron arriba)
        const comprometido = await tx.solicitud_item.aggregate({
            _sum: { cantidad: true },
            where: {
                productoid: item.productoId,
                solicitud: {
                    estado: { in: ["PENDIENTE", "APROBADA"] } 
                }
            }
        });

        const stockComprometido = Number(comprometido._sum.cantidad) || 0;
        const disponibleReal = stockFisico - stockComprometido;
        const cantidadSolicitada = Number(item.cantidad);

        // Debug para ver qué está pasando en consola
        console.log(`🔎 Prod: ${item.productoId} | Físico: ${stockFisico} | Apartado: ${stockComprometido} | Disp: ${disponibleReal}`);

        // Si pide más de lo que realmente queda libre -> ERROR
        if (cantidadSolicitada > disponibleReal) {
            const prodInfo = await tx.producto.findUnique({ where: { id: item.productoId } });
            throw new Error(`Stock insuficiente para "${prodInfo?.nombre}". Físico: ${stockFisico}, pero ${stockComprometido} ya están apartados. Disponibles: ${disponibleReal}`);
        }
      }

      // =======================================================
      // B. GENERACIÓN DE CÓDIGO
      // =======================================================
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

      // C. Crear Cabecera
      const solicitud = await tx.solicitud.create({
        data: {
          id: codigoGenerado,
          solicitanteid: finalSolicitanteId,
          bodegaid: bodegaId,
          estado: "PENDIENTE",
          fecha: new Date()
        }
      });

      // D. Crear Items
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
// PATCH /api/solicitudes/:id/estado
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
// GET /api/solicitudes/:id/export
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
// POST /api/solicitudes/:id/entregar
// (GENERACIÓN DE SALIDA AUTOMÁTICA)
// ===============================
router.post("/:id/entregar", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const userId = req.user?.id; 

    if (!userId) {
        return res.status(401).json({ message: "No se pudo identificar al usuario que realiza la entrega." });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Buscar la solicitud original
      const solicitud = await tx.solicitud.findUnique({
        where: { id },
        include: { solicitud_item: true }
      });

      if (!solicitud) throw new Error("Solicitud no encontrada");
      
      if (solicitud.estado === "ENTREGADA" || solicitud.estado === "RECHAZADA") {
          throw new Error(`La solicitud ya está en estado ${solicitud.estado} y no se puede procesar nuevamente.`);
      }

      // 2. Generar Consecutivo Salida
      const anioActual = new Date().getFullYear();
      let nuevoCorrelativo = 1;

      const contador = await tx.consecutivo.findUnique({
          where: { tipo_anio: { tipo: "SALIDA", anio: anioActual } }
      });

      if (contador) {
          const actualizado = await tx.consecutivo.update({
              where: { id: contador.id },
              data: { ultimo: { increment: 1 } }
          });
          nuevoCorrelativo = actualizado.ultimo || 1;
      } else {
          await tx.consecutivo.create({
              data: { tipo: "SALIDA", anio: anioActual, ultimo: 1, prefijo: "SAL" }
          });
          nuevoCorrelativo = 1;
      }
      
      const codigoDoc = `SAL-${anioActual}-${nuevoCorrelativo.toString().padStart(4, '0')}`;

      // 3. Crear el Documento de Salida
      const documento = await tx.documento.create({
        data: {
          tipo: "SALIDA",
          estado: "APROBADO",
          fecha: new Date(),
          creadorid: userId,
          bodegaorigenid: solicitud.bodegaid,
          solicitanteid: solicitud.solicitanteid,
          consecutivo: codigoDoc,
          observacion: `Generado automáticamente desde Solicitud ${solicitud.id}`
        }
      });

      // 4. Copiar Items con VALIDACIÓN FINAL DE STOCK (Física)
      // Nota: Aquí solo validamos FÍSICO porque al "Entregar" estamos convirtiendo "Comprometido" en "Salida Real".
      // Es decir, estamos consumiendo nuestra propia reserva.
      for (const item of solicitud.solicitud_item) {
        
        const entradas = await tx.documento_item.aggregate({
             _sum: { cantidad: true },
             where: {
                 productoid: item.productoid,
                 documento: { tipo: "INGRESO", estado: "APROBADO" }
             }
         });

         const salidas = await tx.documento_item.aggregate({
            _sum: { cantidad: true },
            where: {
                productoid: item.productoid,
                documento: { tipo: "SALIDA", estado: "APROBADO" }
            }
        });

        const stockFisicoAlMomento = (Number(entradas._sum.cantidad) || 0) - (Number(salidas._sum.cantidad) || 0);
        
        if (stockFisicoAlMomento < Number(item.cantidad)) {
            const prod = await tx.producto.findUnique({ where: { id: item.productoid }, select: { nombre: true } });
            throw new Error(`¡ALTO! Error crítico. El stock FÍSICO es insuficiente para despachar "${prod?.nombre}". Hay: ${stockFisicoAlMomento}, Necesitas: ${item.cantidad}`);
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

      // 5. Actualizar Solicitud
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