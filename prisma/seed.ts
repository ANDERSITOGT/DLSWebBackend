import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando sembrado de datos (Seeding)...");

  // ===============================================
  // 1. UNIDADES DE MEDIDA
  // ===============================================
  const unidades = [
    { nombre: "Centímetro Cúbico", abreviatura: "cc" },
    { nombre: "Mililitro", abreviatura: "ml" },
    { nombre: "Litro", abreviatura: "lt" },
    { nombre: "Galón", abreviatura: "gal" },
    { nombre: "Tonel (200L)", abreviatura: "tonel" },
    { nombre: "Gramo", abreviatura: "gr" },
    { nombre: "Onza", abreviatura: "oz" },
    { nombre: "Libra", abreviatura: "lb" },
    { nombre: "Kilogramo", abreviatura: "kg" },
    { nombre: "Quintal", abreviatura: "qq" },
    { nombre: "Unidad", abreviatura: "und" },
    { nombre: "Saco", abreviatura: "saco" },
    { nombre: "Rollo", abreviatura: "rollo" },
    { nombre: "Juego/Kit", abreviatura: "juego" },
  ];

  console.log("📏 Verificando Unidades de Medida...");
  
  for (const u of unidades) {
    const existente = await prisma.unidad.findFirst({
        where: { abreviatura: u.abreviatura }
    });

    if (!existente) {
        await prisma.unidad.create({ data: u });
        console.log(`   + Creada unidad: ${u.abreviatura}`);
    }
  }

  // ===============================================
  // 2. CATEGORÍAS
  // ===============================================
  const categorias = [
    "Insecticidas", "Fungicidas", "Herbicidas", "Nematicidas",
    "Acaricidas", "Bactericidas", "Fertilizantes Foliares",
    "Fertilizantes Edáficos", "Bioestimulantes", "Enmiendas de Suelo",
    "Adherentes / Dispersantes", "Reguladores de pH",
    "Herramientas Manuales", "Equipo de Protección (EPP)",
    "Equipo de Aplicación", "Materiales de Riego",
    "Combustibles y Lubricantes", "Semillas"
  ];

  console.log("🏷️  Verificando Categorías...");

  for (const nombreCat of categorias) {
      const existente = await prisma.categoria.findFirst({
          where: { nombre: nombreCat }
      });

      if (!existente) {
          await prisma.categoria.create({ data: { nombre: nombreCat } });
          console.log(`   + Creada categoría: ${nombreCat}`);
      }
  }

  // ===============================================
  // 3. USUARIO ADMIN DE RESPALDO
  // ===============================================
  console.log("👤 Verificando Super Admin...");

  const adminData = {
    id: "7936e8e8-f2fd-495a-b978-62ee58559736",
    email: "admin@dls.com",
    nombre: "Administrador", // Corregido según tu imagen
    password: "$2b$10$9bQMjz4CILML9jBv4.qGbu1o/QDzf9O4dfT52alZwYfH7od9.n/UG",
    // la contraseña es "admin123" encriptada con bcrypt
    rol: "ADMIN" as any, 
    activo: true
  };

  await prisma.usuario.upsert({
    where: { id: adminData.id },
    update: {}, 
    create: adminData,
  });

  console.log("✅ Seed completado exitosamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error en el Seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });