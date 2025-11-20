// src/test.ts
import { prisma } from "./prisma";

async function main() {
  // Crear una unidad de prueba
  await prisma.unidad.create({
    data: {
      nombre: "Kilogramos",
      abreviatura: "kg"
    }
  });

  // Obtener todas las unidades
  const unidades = await prisma.unidad.findMany();
  console.log(unidades);
}

main();

