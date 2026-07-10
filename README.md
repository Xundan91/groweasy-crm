# GrowEasy AI CSV Importer

An AI-powered CSV importer that previews arbitrary CSV files in the browser, then maps messy lead data into the GrowEasy CRM schema through a Node.js API.

## Features

- Next.js responsive frontend with drag-and-drop CSV upload.
- Client-side CSV preview before backend or AI processing starts.
- Sticky-header tables with horizontal and vertical scrolling.
- Express API that accepts CSV uploads, parses rows, batches AI extraction, and returns structured JSON.
- Gemini-powered extraction when `GEMINI_API_KEY` is configured.
- Deterministic fallback extractor for local demos without an API key.
- Validation for allowed CRM statuses, allowed data sources, date compatibility, duplicate emails/phones, and invalid rows.

## Tech Stack

- Frontend: Next.js, React, TypeScript, Papa Parse
- Backend: Node.js, Express, TypeScript, Multer, csv-parse, Gemini
- State: Stateless, no database required

## CRM Output Fields

The backend returns:

`created_at`, `name`, `email`, `country_code`, `mobile_without_country_code`, `company`, `city`, `state`, `country`, `lead_owner`, `crm_status`, `crm_note`, `data_source`, `possession_time`, `description`

Rows without both `email` and `mobile_without_country_code` are skipped.

## Local Setup

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
npm run dev
```

Frontend runs at `http://localhost:3000`.
Backend runs at `http://localhost:4000`.

## Environment Variables

Backend:

```bash
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-3.5-flash
```

Frontend:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

If `GEMINI_API_KEY` is blank, the backend still works with the fallback extractor. That is useful for reviewers who want to test the full upload and result flow without setting up an LLM key.

## API

### `POST /api/import`

Accepts multipart form data:

- `file`: CSV file

Returns:

```json
{
  "totalRows": 5,
  "totalImported": 4,
  "totalSkipped": 1,
  "usedAi": true,
  "records": [],
  "skipped": []
}
```

## Testing the Flow

A sample CSV is included at `samples/messy-leads.csv`.

1. Start the app with `npm run dev`.
2. Upload `samples/messy-leads.csv`.
3. Review the browser preview.
4. Click `Confirm Import`.
5. Review parsed CRM records and skipped rows.

## Production Notes

- Deploy `frontend` to Vercel.
- Deploy `backend` to Render, Railway, Fly.io, or another Node.js host.
- Set `NEXT_PUBLIC_API_BASE_URL` to the deployed backend URL.
- Set `FRONTEND_ORIGIN` on the backend to the deployed frontend URL.
- Add `GEMINI_API_KEY` and optionally tune `GEMINI_MODEL`.

## Submission Checklist

- Hosted application URL
- Public GitHub repository URL
- Position applied for: Software Developer Intern or Software Developer (Full-Time)
