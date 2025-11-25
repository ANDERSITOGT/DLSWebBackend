// src/routes/categorias.ts
import express from "express";
import { categoriaService } from "../services/categoriaService";

const router = express.Router();

// GET /api/categorias
router.get("/", async (_req, res) => {
  try {
    const categorias = await categoriaService.getCategorias();
    res.json({ categorias });
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    res.status(500).json({ error: "Error al obtener categorías" });
  }
});

export default router;
