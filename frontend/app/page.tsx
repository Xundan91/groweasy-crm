"use client";

import Papa from "papaparse";
import { useEffect, useMemo, useRef, useState } from "react";
import { DataTable } from "@/components/DataTable";
import type { CsvPreviewRow, ImportResponse } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const PREVIEW_ROW_LIMIT = 500;

export default function Home() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CsvPreviewRow[]>([]);
  const [uploadedRowCount, setUploadedRowCount] = useState(0);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const previewRows = useMemo(() => rows.slice(0, 100), [rows]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function resetResult() {
    setResult(null);
    setError("");
  }

  function handleFile(nextFile: File | undefined) {
    resetResult();
    if (!nextFile) return;

    if (!nextFile.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a valid CSV file.");
      return;
    }

    setFile(nextFile);
    setRows([]);
    setUploadedRowCount(0);
    setIsParsing(true);

    Papa.parse<CsvPreviewRow>(nextFile, {
      header: true,
      skipEmptyLines: true,
      chunkSize: 1024 * 128,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      chunk: ({ data, errors }) => {
        if (errors.length > 0) {
          setError(errors[0]?.message ?? "Could not parse the CSV file.");
          setRows([]);
          setUploadedRowCount(0);
          setIsParsing(false);
          return;
        }
        setUploadedRowCount((count) => count + data.length);
        setRows((currentRows) => {
          if (currentRows.length >= PREVIEW_ROW_LIMIT) return currentRows;
          return [...currentRows, ...data].slice(0, PREVIEW_ROW_LIMIT);
        });
      },
      complete: () => {
        setIsParsing(false);
      },
      error: (parseError) => {
        setError(parseError.message);
        setRows([]);
        setUploadedRowCount(0);
        setIsParsing(false);
      }
    });
  }

  async function confirmImport() {
    if (!file || isParsing) return;
    setIsImporting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/api/import`, {
        method: "POST",
        body: formData
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Import failed");
      }
      setResult(payload);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">GrowEasy Assignment</p>
          <h1>AI-powered CSV importer for messy CRM leads</h1>
          <p className="hero__copy">
            Upload any valid CSV, preview it locally, then confirm to map messy columns into GrowEasy CRM
            records with AI-assisted extraction.
          </p>
          <div className="step-list" aria-label="Import steps">
            <span>1. Upload CSV</span>
            <span>2. Preview rows</span>
            <span>3. Confirm AI import</span>
          </div>
        </div>
        <div className="hero__actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"))}
          >
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
          <div className="hero__badge">Next.js + Express + Gemini</div>
        </div>
      </section>

      <section
        className={`dropzone ${isDragging ? "dropzone--active" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFile(event.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => handleFile(event.target.files?.[0])}
          hidden
        />
        <div className="dropzone__icon">CSV</div>
        <h2>Upload CSV</h2>
        <p>Drag and drop your file here, or choose a CSV from your computer.</p>
        <p className="dropzone__hint">Preview happens instantly in the browser. AI extraction starts only after confirmation.</p>
        <button type="button" className="button button--secondary" onClick={() => inputRef.current?.click()}>
          Choose File
        </button>
        {file ? <p className="file-name">{file.name}</p> : null}
      </section>

      {error ? <div className="alert">{error}</div> : null}

      {isParsing ? (
        <section className="progress-card progress-card--compact">
          <div className="spinner" />
          <div>
            <h2>Reading CSV incrementally</h2>
            <p>{uploadedRowCount.toLocaleString()} rows parsed locally so far. Preview will appear as rows stream in.</p>
          </div>
        </section>
      ) : null}

      {uploadedRowCount > 0 ? (
        <>
          <section className="summary-grid">
            <Metric label="Uploaded rows" value={uploadedRowCount} />
            <Metric label="Preview rows" value={previewRows.length} />
            <Metric
              label="AI status"
              value={isParsing ? "Reading CSV" : result ? (result.usedAi ? "Used AI" : "Fallback") : "Not started"}
            />
          </section>

          <DataTable title="CSV Preview" rows={previewRows} emptyMessage="Upload a CSV to preview rows." />

          <div className="actions">
            <button
              type="button"
              className="button"
              onClick={confirmImport}
              disabled={isImporting || isParsing || uploadedRowCount === 0}
            >
              {isImporting ? "Extracting leads..." : "Confirm Import"}
            </button>
            <p>No backend or AI processing happens until you confirm.</p>
          </div>
        </>
      ) : null}

      {isImporting ? (
        <section className="progress-card">
          <div className="spinner" />
          <div>
            <h2>Processing in batches</h2>
            <p>The backend is parsing records and mapping fields into the GrowEasy CRM schema.</p>
            <p className="progress-card__note">
              This API is deployed on Render. If the service is waking from a cold start, it may take more
              than 2 minutes. Please keep this tab open and be patient.
            </p>
          </div>
        </section>
      ) : null}

      {result ? (
        <>
          <section className="summary-grid">
            <Metric label="Total imported" value={result.totalImported} tone="success" />
            <Metric label="Total skipped" value={result.totalSkipped} tone="warning" />
            <Metric label="Total rows" value={result.totalRows} />
          </section>

          <DataTable title="Successfully Parsed CRM Records" rows={result.records} emptyMessage="No records parsed." />
          <DataTable
            title="Skipped Records"
            rows={result.skipped.map((skip) => ({
              rowNumber: skip.rowNumber,
              reason: skip.reason,
              original: JSON.stringify(skip.original)
            }))}
            emptyMessage="No skipped records."
            maxHeight={260}
          />
        </>
      ) : null}
    </main>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: string | number;
  tone?: "success" | "warning";
}) {
  return (
    <div className={`metric ${tone ? `metric--${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
