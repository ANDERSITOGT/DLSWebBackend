// src/services/categoriaService.ts
import prisma from "../prisma";

export type CategoriaDTO = {
  id: string;
  nombre: string;
};

export const categoriaService = {
  async getCategorias(): Promise<CategoriaDTO[]> {
    const categorias = await prisma.categoria.findMany({
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
      },
    });

    return categorias;
  },
};
