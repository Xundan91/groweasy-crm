import { parse } from "csv-parse/sync";
import type { CsvRow } from "./types.js";

export function parseCsv(buffer: Buffer): CsvRow[] {
  const content = buffer.toString("utf8").replace(/^\uFEFF/, "");

  return parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true
  }).map((row: Record<string, unknown>) => {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key.trim(), String(value ?? "").trim()])
    );
  });
}
