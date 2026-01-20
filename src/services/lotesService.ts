import prisma from "../prisma";

/**
 * Obtiene el listado de lotes.
 * - Si es ADMIN: Devuelve todos los lotes (para poder asignarlos).
 * - Si es SOLICITANTE: Devuelve solo los que tiene asignados (para hacer pedidos).
 */
async function getLotes(usuarioId?: string, usuarioRol?: string) {
  const where: any = {};

  // 🛡️ Lógica de Seguridad:
  // Si el usuario es SOLICITANTE, filtramos.
  // Si es ADMIN, esta condición se salta y devuelve TODOS los lotes.
  if (usuarioRol === "SOLICITANTE" && usuarioId) {
    where.encargados = {
      some: {
        usuarioid: usuarioId
      }
    };
  }

  return await prisma.lote.findMany({
    where,
    include: {
      finca: {
        select: { nombre: true } // 👈 Necesario para mostrar "Finca La Esmeralda" en el frontend
      },
      cultivo: {
        select: { nombre: true }
      }
    },
    orderBy: {
      codigo: 'asc'
    }
  });
}

export default {
  getLotes
};