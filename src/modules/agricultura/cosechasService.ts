import prisma from "../../core/prisma";
import { parsearFechaNegocio } from "../../core/tiempo";

export type BoletaCosechaInput = {
  empacadoraId: string;
  numero_boleta?: string | null;
  libras: number;
  fecha_envio?: string | Date;
};

export type CrearCosechaInput = {
  loteId: string;
  fecha: string | Date;
  libras_campo: number;
  libras_rechazo?: number | null;
  libras_vendidas?: number | null;
  observaciones?: string | null;
  empacadoraId?: string;
  numero_boleta?: string | null;
  boletas?: BoletaCosechaInput[];
};

function obtenerBoletas(data: CrearCosechaInput): BoletaCosechaInput[] {
  if (data.boletas) return data.boletas;
  if (!data.empacadoraId) return [];

  return [
    {
      empacadoraId: data.empacadoraId,
      numero_boleta: data.numero_boleta,
      libras: data.libras_vendidas ?? 0,
      fecha_envio: data.fecha,
    },
  ];
}

export const cosechasService = {
  async crearCosecha(data: CrearCosechaInput, userId: string) {
    const boletas = obtenerBoletas(data);

    return prisma.$transaction(async (tx) => {
            return tx.cosecha.create({
        data: {
          loteid: data.loteId,
          // Fecha pura de calendario: se fija a mediodía GT para que el
          // dashboard de cosechas la agrupe en el día correcto.
          fecha: parsearFechaNegocio(data.fecha, false),
          libras_campo: data.libras_campo,
          libras_rechazo: data.libras_rechazo ?? null,
          libras_vendidas: data.libras_vendidas ?? null,
          observaciones: data.observaciones ?? null,
          creadorid: userId,
          boleta_cosecha: boletas.length
            ? {
                create: boletas.map((boleta) => ({
                  empacadoraid: boleta.empacadoraId,
                  numero_boleta: boleta.numero_boleta ?? null,
                  libras: boleta.libras,
                  fecha_envio: parsearFechaNegocio(boleta.fecha_envio ?? data.fecha, false),
                })),
              }
            : undefined,
        },
        include: {
          boleta_cosecha: {
            include: { empacadora: true },
          },
        },
      });
    });
  },

  async getListadoCosechas() {
    return prisma.cosecha.findMany({
      orderBy: { fecha: "desc" },
      include: {
        lote: {
          include: {
            finca: true,
            cultivo: true,
          },
        },
        boleta_cosecha: {
          include: { empacadora: true },
        },
      },
    });
  },
};
