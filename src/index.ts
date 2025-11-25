// src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import inicioRouter from "./routes/inicio";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Rutas
app.use("/api/inicio", inicioRouter);

app.get("/api/health", async (req, res) => {
  try {
    // Aquí solo comprobamos que el server está arriba.
    res.json({ ok: true, db: "online" });
  } catch (error) {
    console.error("Error en /api/health:", error);
    res.status(500).json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log("Servidor backend corriendo en puerto", PORT);
});
