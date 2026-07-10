"use client";

import { useMemo, useState } from "react";

type DataTableProps<T extends Record<string, unknown>> = {
  title: string;
  rows: T[];
  emptyMessage: string;
  maxHeight?: number;
};

const ROW_HEIGHT = 54;
const OVERSCAN_ROWS = 8;

export function DataTable<T extends Record<string, unknown>>({
  title,
  rows,
  emptyMessage,
  maxHeight = 420
}: DataTableProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const columns = useMemo(() => Array.from(new Set(rows.flatMap((row) => Object.keys(row)))), [rows]);
  const shouldVirtualize = rows.length > 100;
  const visibleRowCount = Math.ceil(maxHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2;
  const startIndex = shouldVirtualize ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS) : 0;
  const endIndex = shouldVirtualize ? Math.min(rows.length, startIndex + visibleRowCount) : rows.length;
  const visibleRows = rows.slice(startIndex, endIndex);
  const topSpacerHeight = shouldVirtualize ? startIndex * ROW_HEIGHT : 0;
  const bottomSpacerHeight = shouldVirtualize ? Math.max(0, (rows.length - endIndex) * ROW_HEIGHT) : 0;

  return (
    <section className="table-card">
      <div className="table-card__header">
        <h2>{title}</h2>
        <span>{rows.length.toLocaleString()} rows</span>
      </div>

      {rows.length === 0 ? (
        <p className="empty-state">{emptyMessage}</p>
      ) : (
        <div className="table-wrap" style={{ maxHeight }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topSpacerHeight > 0 ? (
                <tr className="table-spacer" style={{ height: topSpacerHeight }}>
                  <td colSpan={columns.length} />
                </tr>
              ) : null}
              {visibleRows.map((row, rowIndex) => (
                <tr key={startIndex + rowIndex}>
                  {columns.map((column) => (
                    <td key={column}>{formatCell(row[column])}</td>
                  ))}
                </tr>
              ))}
              {bottomSpacerHeight > 0 ? (
                <tr className="table-spacer" style={{ height: bottomSpacerHeight }}>
                  <td colSpan={columns.length} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
