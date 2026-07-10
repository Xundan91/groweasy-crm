type DataTableProps<T extends Record<string, unknown>> = {
  title: string;
  rows: T[];
  emptyMessage: string;
  maxHeight?: number;
};

export function DataTable<T extends Record<string, unknown>>({
  title,
  rows,
  emptyMessage,
  maxHeight = 420
}: DataTableProps<T>) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

  return (
    <section className="table-card">
      <div className="table-card__header">
        <h2>{title}</h2>
        <span>{rows.length.toLocaleString()} rows</span>
      </div>

      {rows.length === 0 ? (
        <p className="empty-state">{emptyMessage}</p>
      ) : (
        <div className="table-wrap" style={{ maxHeight }}>
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => (
                    <td key={column}>{formatCell(row[column])}</td>
                  ))}
                </tr>
              ))}
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
