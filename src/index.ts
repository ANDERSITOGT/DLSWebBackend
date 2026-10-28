// src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import inicioRouter from "./modules/dashboard/inicio";
import inventarioRouter from "./modules/inventario/inventario";
import categoriasRouter from "./modules/inventario/categorias";
import solicitudesRouter from "./modules/solicitudes/solicitudes";
import authRouter from "./modules/auth/auth";
import movimientosRouter from "./modules/movimientos/movimientos";
import usuariosRoutes from "./modules/usuarios/usuarios";
import productosRoutes from "./modules/inventario/productos";
import proveedoresRouter from "./modules/catalogos/proveedores";
import lotesRouter from "./modules/agricultura/historialLotes";
import fincasRouter from "./modules/agricultura/fincas";
import edicionCriticaRouter from "./modules/admin/edicionCritica";
import cosechasRouter from "./modules/agricultura/cosechas";

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
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/proveedores", proveedoresRouter);
app.use("/api/lotes", lotesRouter);
app.use("/api/fincas", fincasRouter);
app.use("/api/cosechas", cosechasRouter);
app.use("/api/edicion-critica", edicionCriticaRouter);


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