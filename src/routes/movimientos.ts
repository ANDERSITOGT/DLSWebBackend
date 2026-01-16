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
// REGISTRAR INGRESO
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

    // 👇 AQUÍ ESTÁ EL CAMBIO CLAVE: Configuración de timeout
    const resultado = await prisma.$transaction(async (tx) => {
      
      // 1. GENERACIÓN DE CÓDIGO CONSECUTIVO
      const anioActual = new Date().getFullYear();
      let nuevoCorrelativo = 1;

      const contador = await tx.consecutivo.findUnique({
          where: {
             tipo_anio: { tipo: "INGRESO", anio: anioActual }
          }
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

      // 2. CREAR DOCUMENTO
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

      // 3. Crear Comprobante Fiscal
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

      // 4. Items + Precio Inteligente
      for (const item of items) {
        const productoInfo = await tx.producto.findUnique({ where: { id: item.productoId } });
        if (!productoInfo) throw new Error(`Producto ${item.productoId} no encontrado`);

        // Guardar Item
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

        // Lógica de Moda (Precio Inteligente)
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

    }, {
      // ⚠️ CONFIGURACIÓN DE TIEMPO AUMENTADA ⚠️
      maxWait: 5000, // Tiempo máximo esperando para iniciar la transacción
      timeout: 20000 // 20 Segundos para terminar toda la operación (antes eran 5s)
    });

    res.json({ ok: true, documento: resultado, message: "Ingreso registrado correctamente" });

  } catch (error: any) {
    console.error("Error al crear ingreso:", error);
    // Mejora en el log para ver el error real
    res.status(500).json({ message: "Error interno", error: error.message || error });
  }
});

// ... (El resto de tus rutas GET siguen igual abajo)
// ================================
// RUTAS DE LECTURA 
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