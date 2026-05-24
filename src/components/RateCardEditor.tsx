"use client";
import { useState } from "react";

export default function RateCardEditor({
  title,
  rows: initialRows,
  onSave,
}: {
  title: string;
  rows: string[][];
  onSave: (rows: string[][]) => Promise<void>;
}) {
  const [rows, setRows] = useState<string[][]>(
    initialRows.length > 0 ? initialRows : [["Class", "Rate Per Hour"]]
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);

  function updateCell(rowIdx: number, colIdx: number, val: string) {
    setRows((prev) => {
      const next = prev.map((r) => [...r]);
      while (next[rowIdx + 1].length <= colIdx) next[rowIdx + 1].push("");
      next[rowIdx + 1][colIdx] = val;
      return next;
    });
    setSaved(false);
  }

  function updateHeader(colIdx: number, val: string) {
    setRows((prev) => {
      const next = prev.map((r) => [...r]);
      while (next[0].length <= colIdx) next[0].push("");
      next[0][colIdx] = val;
      return next;
    });
    setSaved(false);
  }

  function addRow() {
    setRows((prev) => [...prev, Array(headers.length).fill("")]);
    setSaved(false);
  }

  function addColumn() {
    setRows((prev) =>
      prev.map((r) => [...r, ""])
    );
    setSaved(false);
  }

  function deleteRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx + 1));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(rows);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={addColumn}
            className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-md text-sm hover:bg-gray-50"
          >
            + Column
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              saved
                ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                : "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            }`}
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr className="bg-gray-50">
              {headers.map((h, ci) => (
                <th key={ci} className="border-b border-r border-gray-200 px-1 py-1 last:border-r-0">
                  <input
                    value={h}
                    onChange={(e) => updateHeader(ci, e.target.value)}
                    className="w-full min-w-[100px] px-1.5 py-1 bg-transparent font-semibold text-gray-700 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded"
                  />
                </th>
              ))}
              <th className="border-b border-gray-200 w-8 px-1" />
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} className="hover:bg-gray-50">
                {headers.map((_, ci) => (
                  <td key={ci} className="border-b border-r border-gray-100 px-1 py-0.5 last:border-r-0">
                    <input
                      value={row[ci] ?? ""}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      className="w-full min-w-[100px] px-1.5 py-1 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded text-sm"
                    />
                  </td>
                ))}
                <td className="border-b border-gray-100 px-1 py-0.5 text-center">
                  <button
                    onClick={() => deleteRow(ri)}
                    className="text-red-400 hover:text-red-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addRow}
        className="text-sm text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1"
      >
        + Add Row
      </button>

      {rows.length < 2 && (
        <p className="text-xs text-gray-400 italic">
          No data rows yet. Click "+ Add Row" to start.
        </p>
      )}
    </div>
  );
}
