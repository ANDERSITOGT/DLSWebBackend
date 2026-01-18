// src/routes/movimientos.ts
import { Router, Response } from "express";
import prisma from "../prisma";
import { authenticateToken, AuthRequest } from "../middlewares/auth";
import { movimientosService } from "../services/movimientosService";

const router = Router();

// ==========================================
// FUNCIÓN AUXILIAR: CALCULAR MODA
// ==========================================
function calcularModa(precios: number[]): number {
  if (precios.length === 0) return 0;
  
  const frecuencia: Record<string, number> = {};
  let maxFrecuencia = 0;
  let moda = precios[0];

  for (const p of precios) {
    const key = p.toString();
    frecuencia[key] = (frecuencia[key] || 0) + 1;
    
    if (frecuencia[key] > maxFrecuencia) {
      maxFrecuencia = frecuencia[key];
      moda = p;
    }
  }
  return moda;
}

// ==========================================
// POST /api/movimientos/ingreso
// ==========================================
router.post("/ingreso", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      bodegaId, proveedorId, fecha, 
      tipoComprobante, factura, serie, uuid, 
      observaciones, items 
    } = req.body;

    if (!bodegaId || !items || items.length === 0) {
      return res.status(400).json({ message: "Faltan datos obligatorios." });
    }
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ message: "Error de identidad." });

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Consecutivo
      const anioActual = new Date().getFullYear();
      let nuevoCorrelativo = 1;

      const contador = await tx.consecutivo.findUnique({
          where: { tipo_anio: { tipo: "INGRESO", anio: anioActual } }
      });

      if (contador) {
          const actualizado = await tx.consecutivo.update({
              where: { id: contador.id },
              data: { ultimo: { increment: 1 } }
          });
          nuevoCorrelativo = actualizado.ultimo || 1;
      } else {
          await tx.consecutivo.create({
              data: { tipo: "INGRESO", anio: anioActual, ultimo: 1, prefijo: "ING" }
          });
          nuevoCorrelativo = 1;
      }

      const codigoGenerado = `ING-${anioActual}-${nuevoCorrelativo.toString().padStart(4, '0')}`;

      // 2. Documento
      const documento = await tx.documento.create({
        data: {
          tipo: "INGRESO",
          estado: "APROBADO",
          consecutivo: codigoGenerado,
          fecha: fecha ? new Date(fecha) : new Date(),
          bodegadestinoid: bodegaId,
          proveedorid: proveedorId || null,
          creadorid: userId,
          observacion: observaciones || "" 
        },
      });

      // 3. Comprobante Fiscal
      if (proveedorId && factura) {
        const proveedorData = await tx.proveedor.findUnique({ where: { id: proveedorId } });
        await tx.comprobante_fiscal.create({
            data: {
                documentoid: documento.id,
                tipocomprobante: tipoComprobante || "FACTURA",
                nitemisor: proveedorData?.nit || "CF",
                numero: factura,
                serie: serie || null,
                uuid: uuid || null,
                fechaemision: fecha ? new Date(fecha) : new Date(),
            }
        });
      }

      // 4. Items
      for (const item of items) {
        const productoInfo = await tx.producto.findUnique({ where: { id: item.productoId } });
        if (!productoInfo) throw new Error(`Producto ${item.productoId} no encontrado`);

        await tx.documento_item.create({
          data: {
            documentoid: documento.id,
            productoid: item.productoId,
            cantidad: item.cantidad,
            costounit: item.costo,
            unidadid: productoInfo.unidadid,
            loteid: item.loteId || null
          },
        });

        // Moda de Precios
        const ultimosIngresos = await tx.documento_item.findMany({
            where: {
                productoid: item.productoId,
                documento: { tipo: "INGRESO", estado: "APROBADO" }
            },
            orderBy: { createdat: "desc" },
            take: 10,
            select: { costounit: true }
        });

        const precios = ultimosIngresos.map(u => Number(u.costounit));
        if (precios.length === 0) precios.push(Number(item.costo));
        const nuevoPrecioRef = calcularModa(precios);

        await tx.producto.update({
            where: { id: item.productoId },
            data: { precioref: nuevoPrecioRef }
        });
      }

      return documento;
    }, { maxWait: 5000, timeout: 20000 });

    res.json({ ok: true, documento: resultado, message: "Ingreso registrado correctamente" });
  } catch (error: any) {
    console.error("Error al crear ingreso:", error);
    res.status(500).json({ message: "Error interno", error: error.message || error });
  }
});

// ==========================================
// POST /api/movimientos/ajuste
// ==========================================
router.post("/ajuste", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { productoId, cantidad, notas, tipo } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ message: "No autorizado" });
    if (!productoId || !cantidad || !notas) return res.status(400).json({ message: "Faltan datos" });

    const userRole = req.user?.rol;
    if (userRole !== "ADMIN" && userRole !== "BODEGUERO") {
        return res.status(403).json({ message: "No tienes permisos para realizar ajustes." });
    }

    const resultado = await prisma.$transaction(async (tx) => {
        const anioActual = new Date().getFullYear();
        let nuevoCorrelativo = 1;

        const contador = await tx.consecutivo.findUnique({
             where: { tipo_anio: { tipo: "AJUSTE", anio: anioActual } }
        });

        if (contador) {
             const actualizado = await tx.consecutivo.update({
                 where: { id: contador.id },
                 data: { ultimo: { increment: 1 } }
             });
             nuevoCorrelativo = actualizado.ultimo || 1;
        } else {
             await tx.consecutivo.create({
                 data: { tipo: "AJUSTE", anio: anioActual, ultimo: 1, prefijo: "AJU" }
             });
             nuevoCorrelativo = 1;
        }

        const codigoGenerado = `AJU-${anioActual}-${nuevoCorrelativo.toString().padStart(4, '0')}`;
        const bodegaDefault = await tx.bodega.findFirst();

        const documento = await tx.documento.create({
            data: {
                tipo: "AJUSTE",
                estado: "APROBADO",
                consecutivo: codigoGenerado,
                fecha: new Date(),
                creadorid: userId,
                bodegaorigenid: bodegaDefault?.id,
                observacion: notas
            }
        });

        const prod = await tx.producto.findUnique({ where: { id: productoId } });
        if (!prod) throw new Error("Producto no encontrado");

        await tx.documento_item.create({
            data: {
                documentoid: documento.id,
                productoid: productoId,
                unidadid: prod.unidadid,
                cantidad: Number(cantidad),
                notas: `Ajuste manual (${tipo})`
            }
        });
        return documento;
    });

    res.json({ ok: true, documento: resultado });
  } catch (error: any) {
    console.error("Error al crear ajuste:", error);
    res.status(500).json({ message: "Error al guardar ajuste", error: error.message });
  }
});

// ==========================================
// POST /api/movimientos/devolucion-proveedor
// (NUEVO 🚀: Salida Directa a Proveedor)
// ==========================================
router.post("/devolucion-proveedor", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { proveedorId, bodegaId, items, notas } = req.body;
      const userId = req.user?.id;
  
      if (!userId) return res.status(401).json({ message: "No autorizado" });
      if (!proveedorId || !items || items.length === 0) return res.status(400).json({ message: "Faltan datos" });
  
      // Solo bodeguero o admin pueden devolver a proveedor (es una salida de dinero/material)
      const userRole = req.user?.rol;
      if (userRole !== "ADMIN" && userRole !== "BODEGUERO") {
          return res.status(403).json({ message: "No tienes permisos para devolver a proveedores." });
      }
  
      const resultado = await prisma.$transaction(async (tx) => {
          // 1. Consecutivo DEV
          const anioActual = new Date().getFullYear();
          let nuevoCorrelativo = 1;
  
          const contador = await tx.consecutivo.findUnique({
               where: { tipo_anio: { tipo: "DEVOLUCION", anio: anioActual } }
          });
  
          if (contador) {
               const actualizado = await tx.consecutivo.update({
                   where: { id: contador.id },
                   data: { ultimo: { increment: 1 } }
               });
               nuevoCorrelativo = actualizado.ultimo || 1;
          } else {
               await tx.consecutivo.create({
                   data: { tipo: "DEVOLUCION", anio: anioActual, ultimo: 1, prefijo: "DEV" }
               });
               nuevoCorrelativo = 1;
          }
  
          const codigoGenerado = `DEV-${anioActual}-${nuevoCorrelativo.toString().padStart(4, '0')}`;
  
          // 2. Documento (DEVOLUCION con proveedorId = Salida Externa)
          const documento = await tx.documento.create({
              data: {
                  tipo: "DEVOLUCION",
                  estado: "APROBADO",
                  consecutivo: codigoGenerado,
                  fecha: new Date(),
                  creadorid: userId,
                  bodegaorigenid: bodegaId, // Sale de esta bodega
                  proveedorid: proveedorId, // Hacia este proveedor
                  observacion: notas || "Devolución a proveedor"
              }
          });
  
          // 3. Items (Validando Stock porque es Salida)
          for (const item of items) {
              const prod = await tx.producto.findUnique({ where: { id: item.productoId } });
              if (!prod) throw new Error("Producto no encontrado");

              // Validación de Stock Físico (Simple)
              const ingresos = await tx.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: item.productoId, documento: { tipo: "INGRESO", estado: "APROBADO" } } });
              const salidas = await tx.documento_item.aggregate({ _sum: { cantidad: true }, where: { productoid: item.productoId, documento: { tipo: "SALIDA", estado: "APROBADO" } } });
              // (Simplificado para este ejemplo, idealmente usar la fórmula completa de inventarioService)
              const stock = (Number(ingresos._sum.cantidad)||0) - (Number(salidas._sum.cantidad)||0);
              
              // OJO: Si eres estricto, descomenta esto. A veces se fuerza la devolución aunque el sistema diga 0.
              // if (stock < item.cantidad) throw new Error(`Stock insuficiente para devolver ${prod.nombre}`);
  
              await tx.documento_item.create({
                  data: {
                      documentoid: documento.id,
                      productoid: item.productoId,
                      unidadid: prod.unidadid,
                      cantidad: Number(item.cantidad),
                      notas: item.notas
                  }
              });
          }
          return documento;
      });
  
      res.json({ ok: true, documento: resultado });
    } catch (error: any) {
      console.error("Error al devolver a proveedor:", error);
      res.status(500).json({ message: "Error al procesar devolución", error: error.message });
    }
  });


// ================================
// RUTAS DE LECTURA (Sin cambios)
// ================================
router.get("/", async (req, res) => {
  try {
    const data = await movimientosService.getListadoMovimientos();
    res.json({ movimientos: data });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener movimientos" });
  }
});

router.get("/export", async (req, res) => {
  try {
    const { filename, mime, content } = await movimientosService.exportListadoMovimientosPDF();
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    res.status(500).send("Error al exportar");
  }
});

router.get("/lotes", async (req, res) => {
  try {
    const data = await movimientosService.getListadoLotes();
    res.json({ lotes: data });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener lotes" });
  }
});

router.get("/lotes/:id", async (req, res) => {
  try {
    const loteId = req.params.id;
    const data = await movimientosService.getDetalleLote(loteId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener lote" });
  }
});

router.get("/lotes/:id/export", async (req, res) => {
  try {
    const loteId = req.params.id;
    const { filename, mime, content } = await movimientosService.exportHistorialLotePDF(loteId);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    res.status(500).send("Error al exportar");
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const data = await movimientosService.getDetalleMovimiento(id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener detalle" });
  }
});

router.get("/:id/export", async (req, res) => {
  try {
    const id = req.params.id;
    const { filename, mime, content } = await movimientosService.exportMovimientoDetallePDF(id);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    res.status(500).send("Error al exportar detalle");
  }
});

export default router;