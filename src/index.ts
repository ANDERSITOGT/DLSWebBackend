// src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import inicioRouter from "./routes/inicio";
import inventarioRouter from "./routes/inventario";
import categoriasRouter from "./routes/categorias";
import movimientosRoutes from "./routes/movimientos";
import solicitudesRouter from "./routes/solicitudes";
import authRouter from "./routes/auth";
import movimientosRouter from "./routes/movimientos"; 
import catalogosRouter from "./routes/catalogos";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Rutas
app.use("/api/inicio", inicioRouter);
app.use("/api/auth", authRouter);
app.use("/api/inventario", inventarioRouter);
app.use("/api/categorias", categoriasRouter);
app.use("/api/movimientos", movimientosRoutes);
app.use("/api/solicitudes", solicitudesRouter);
app.use("/api/movimientos", movimientosRouter);
app.use("/api/catalogos", catalogosRouter);


// Health check sencillo
app.get("/api/health", async (_req, res) => {
  try {
    res.json({ ok: true, db: "online" });
  } catch (error) {
    console.error("Error en /api/health:", error);
    res.status(500).json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log("Servidor backend corriendo en puerto", PORT);
});
