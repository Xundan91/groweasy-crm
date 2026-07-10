import { GoogleGenAI } from "@google/genai";
import { heuristicExtract, sanitizeRecord } from "./heuristicExtractor.js";
import { DATA_SOURCES, CRM_STATUSES, type CrmRecord, type CsvRow, type SkippedRecord } from "./types.js";

const BATCH_SIZE = 25;
const MAX_AI_ATTEMPTS = 3;

type BatchResult = {
  records: CrmRecord[];
  skipped: SkippedRecord[];
  usedAi: boolean;
};

function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match?.[1]) return match[1].trim();
  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  return objectMatch?.[0] ?? trimmed;
}

function buildPrompt(rows: CsvRow[], offset: number) {
  return `You are extracting CRM leads for GrowEasy from arbitrary CSV rows.

Return ONLY valid JSON with this exact shape:
{
  "records": [
    {
      "created_at": "",
      "name": "",
      "email": "",
      "country_code": "",
      "mobile_without_country_code": "",
      "company": "",
      "city": "",
      "state": "",
      "country": "",
      "lead_owner": "",
      "crm_status": "",
      "crm_note": "",
      "data_source": "",
      "possession_time": "",
      "description": ""
    }
  ],
  "skipped": [
    { "rowNumber": 1, "reason": "Missing both email and mobile number" }
  ]
}

Rules:
- Source rows are numbered starting at ${offset + 1}.
- Skip a row if it has neither email nor mobile number.
- crm_status must be one of ${CRM_STATUSES.join(", ")} or blank.
- data_source must be one of ${DATA_SOURCES.join(", ")} or blank when uncertain.
- created_at must be parseable by JavaScript new Date(created_at), or blank.
- If multiple emails exist, use the first email and put the remaining emails in crm_note.
- If multiple phone numbers exist, use the first mobile and put remaining numbers in crm_note.
- Put remarks, follow-up notes, additional comments, extra contact details, and uncategorized useful info in crm_note.
- Keep every field single-line. Escape any necessary newlines as \\n.
- Prefer accurate blanks over hallucinated values.

Rows:
${JSON.stringify(rows, null, 2)}`;
}

async function extractWithGemini(rows: CsvRow[], offset: number): Promise<BatchResult> {
  const client = getGeminiClient();
  if (!client) return { ...heuristicExtract(rows, offset), usedAi: false };

  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
    try {
      const interaction = (await client.interactions.create({
        model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
        stream: false,
        system_instruction: "You map messy CSV rows into strict CRM JSON. Return only JSON.",
        input: buildPrompt(rows, offset),
        generation_config: {
          temperature: 0
        }
      } as unknown as Parameters<typeof client.interactions.create>[0])) as unknown as { output_text?: string };

      const content = interaction.output_text;
      if (!content) throw new Error("Gemini returned an empty response");

      const parsed = JSON.parse(extractJson(content)) as {
        records?: Partial<CrmRecord>[];
        skipped?: Array<{ rowNumber?: number; reason?: string }>;
      };

      const records = (parsed.records ?? [])
        .map((record) => sanitizeRecord(record))
        .filter((record): record is CrmRecord => Boolean(record));

      const skipped: SkippedRecord[] = (parsed.skipped ?? []).map((skip) => ({
        rowNumber: skip.rowNumber ?? offset + 1,
        reason: skip.reason || "Skipped by AI",
        original: rows[Math.max(0, (skip.rowNumber ?? offset + 1) - offset - 1)] ?? {}
      }));

      return { records, skipped, usedAi: true };
    } catch (error) {
      if (attempt === MAX_AI_ATTEMPTS) {
        console.warn("Gemini extraction failed after retries; falling back to heuristic extraction", error);
        return { ...heuristicExtract(rows, offset), usedAi: false };
      }

      console.warn(`Gemini extraction attempt ${attempt} failed; retrying`, error);
      await sleep(750 * attempt);
    }
  }

  return { ...heuristicExtract(rows, offset), usedAi: false };
}

export async function extractCrmRecords(rows: CsvRow[]) {
  const records: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];
  let usedAi = false;

  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const result = await extractWithGemini(batch, index);
    records.push(...result.records);
    skipped.push(...result.skipped);
    usedAi = usedAi || result.usedAi;
  }

  return { records, skipped, usedAi };
}
