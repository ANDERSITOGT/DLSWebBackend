import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const unidades = await prisma.unidad.findMany();
  console.log(unidades);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
