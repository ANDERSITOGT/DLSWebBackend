import prisma from "../prisma";

/**
 * Obtiene lista de usuarios con rol SOLICITANTE.
 * Incluye la información de los lotes que tienen asignados.
 */
async function getSolicitantesConLotes() {
  return await prisma.usuario.findMany({
    where: {
      rol: "SOLICITANTE",
      activo: true // Opcional: solo mostramos los activos
    },
    select: {
      id: true,
      nombre: true,
      email: true,
      // 👇 Esto es la magia: traemos la relación intermedia y el detalle del lote
      lotes_asignados: {
        include: {
          lote: {
            select: {
              id: true,
              codigo: true,
              finca: { select: { nombre: true } } // Para saber de qué finca es
            }
          }
        }
      }
    },
    orderBy: { nombre: 'asc' }
  });
}

/**
 * Actualiza la asignación de lotes de un usuario.
 * Estrategia: "Borrar todo lo anterior y crear lo nuevo" (Transacción).
 */
async function actualizarAsignacionLotes(usuarioId: string, lotesIds: string[]) {
  // Usamos una transacción para asegurar que o se hace todo o no se hace nada
  return await prisma.$transaction([
    // 1. Eliminar todas las asignaciones actuales de este usuario
    prisma.lote_encargado.deleteMany({
      where: { usuarioid: usuarioId }
    }),
    
    // 2. Crear las nuevas asignaciones (solo si enviaron IDs)
    ...(lotesIds.length > 0 
      ? [
          prisma.lote_encargado.createMany({
            data: lotesIds.map((loteid) => ({
              usuarioid: usuarioId,
              loteid: loteid
            }))
          })
        ]
      : [])
  ]);
}

export default {
  getSolicitantesConLotes,
  actualizarAsignacionLotes
};