// src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import inicioRouter from "./routes/inicio";
import inventarioRouter from "./routes/inventario";
import categoriasRouter from "./routes/categorias";
import solicitudesRouter from "./routes/solicitudes";
import authRouter from "./routes/auth";
import movimientosRouter from "./routes/movimientos"; 
import catalogosRouter from "./routes/catalogos";
import usuariosRoutes from "./routes/usuarios";

dotenv.config();

const app = express();
// Railway asignará un puerto dinámico en la variable PORT, si no existe usa 3001
const PORT = process.env.PORT || 3001;

// Middlewares
// IMPORTANTE: Cuando subamos el frontend, cambiaremos el '*' por la URL real de tu frontend
app.use(cors()); 
app.use(express.json());

// Rutas API
app.use("/api/inicio", inicioRouter);
app.use("/api/auth", authRouter);
app.use("/api/inventario", inventarioRouter);
app.use("/api/categorias", categoriasRouter);
app.use("/api/solicitudes", solicitudesRouter);
app.use("/api/movimientos", movimientosRouter);
app.use("/api/catalogos", catalogosRouter);
app.use("/api/usuarios", usuariosRoutes);

// Health check (Útil para que Railway sepa que tu app vive)
app.get("/api/health", async (_req, res) => {
  try {
    res.json({ ok: true, db: "online", server: "ready" });
  } catch (error) {
    console.error("Error en /api/health:", error);
    res.status(500).json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en puerto ${PORT}`);
});