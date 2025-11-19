import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./prisma";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("DELASIERRA Backend funcionando");
});

// ✅ GET: listar productos
app.get("/api/productos", async (_req, res) => {
  try {
    const productos = await prisma.producto.findMany();
    res.json(productos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

// ✅ POST: crear producto
app.post("/api/productos", async (req, res) => {
  try {
    const { codigo, nombre, unidad } = req.body;

    if (!codigo || !nombre || !unidad) {
      return res.status(400).json({ error: "codigo, nombre y unidad son requeridos" });
    }

    const producto = await prisma.producto.create({
      data: { codigo, nombre, unidad },
    });

    res.status(201).json(producto);
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2002") {
      // código duplicado
      return res.status(409).json({ error: "El código ya existe" });
    }
    res.status(500).json({ error: "Error al crear producto" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
