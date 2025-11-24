import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { inicioRouter } from "./routes/inicio";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/inicio", inicioRouter);

app.get("/api/health", async (_req, res) => {
  try {
    await (await import("./prisma")).default.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "online" });
  } catch {
    res.status(500).json({ ok: false, db: "error" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en puerto`, PORT);
});
