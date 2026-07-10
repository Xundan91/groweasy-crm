import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import { extractCrmRecords } from "./aiExtractor.js";
import { parseCsv } from "./csv.js";
import type { ImportResponse } from "./types.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.includes("csv") || file.originalname.toLowerCase().endsWith(".csv")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only CSV files are supported"));
  }
});

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN?.split(",") ?? "http://localhost:3000"
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/import", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "CSV file is required" });
      return;
    }

    const rows = parseCsv(req.file.buffer);
    if (rows.length === 0) {
      res.status(400).json({ message: "CSV contains no data rows" });
      return;
    }

    const { records, skipped, usedAi } = await extractCrmRecords(rows);
    const response: ImportResponse = {
      totalRows: rows.length,
      totalImported: records.length,
      totalSkipped: skipped.length,
      usedAi,
      records,
      skipped
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({
    message: error.message || "Unexpected server error"
  });
});

app.listen(port, () => {
  console.log(`GrowEasy CSV importer API listening on http://localhost:${port}`);
});
