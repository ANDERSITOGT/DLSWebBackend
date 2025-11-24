import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export default prisma;



export async function connectDB() {
  try {
    await prisma.$connect();
    console.log("✅ Prisma conectado a la base de datos");
  } catch (err) {
    console.error("❌ Error conectando a la base de datos:", err);
    process.exit(1);
  }
}