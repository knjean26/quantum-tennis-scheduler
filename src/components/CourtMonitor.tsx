"use client";
import { useState } from "react";
import type { BookingRecord } from "@/lib/parse";
import { totalCourtHours } from "@/lib/parse";

interface WeekGroup {
  weekStart: string;
  weekLabel: string;
  records: BookingRecord[];
}

const DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const COURT_COLORS: Record<string, string> = {
  "1": "bg-blue-50 text-blue-700 border-blue-200",
  "2": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "3": "bg-amber-50 text-amber-700 border-amber-200",
  "4": "bg-purple-50 text-purple-700 border-purple-200",
  "5": "bg-rose-50 text-rose-700 border-rose-200",
};

const COURT_DOT: Record<string, string> = {
  "1": "bg-blue-400",
  "2": "bg-emerald-400",
  "3": "bg-amber-400",
  "4": "bg-purple-400",
  "5": "bg-rose-400",
};

export default function CourtMonitor({
  weeks,
  defaultWeek = 0,
}: {
  weeks: WeekGroup[];
  defaultWeek?: number;
}) {
  const [selectedWeek, setSelectedWeek] = useState(defaultWeek);
  const week = weeks[selectedWeek];
  if (!week) return <p className="text-gray-400">No data available.</p>;

  const totalHrs = totalCourtHours(week.records);

  // Sort by date then time
  const sorted = [...week.records].sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime)
  );

  // Get unique courts in data
  const activeCourts = [...new Set(sorted.map((r) => r.court))].sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Court Monitor</h1>
          <p className="text-sm text-gray-500 mt-0.5">{week.weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedWeek((w) => Math.max(0, w - 1))}
            disabled={selectedWeek === 0}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ‹
          </button>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {weeks.map((w, i) => (
              <option key={w.weekStart} value={i}>
                {w.weekLabel}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSelectedWeek((w) => Math.min(weeks.length - 1, w + 1))}
            disabled={selectedWeek === weeks.length - 1}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ›
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-6 py-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
            <span className="text-2xl">🎾</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Hours</p>
            <p className="text-3xl font-bold text-emerald-700">{totalHrs}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-6 py-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
            <span className="text-2xl">📋</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Bookings</p>
            <p className="text-3xl font-bold text-gray-700">{sorted.length}</p>
          </div>
        </div>
        {/* Per-court mini badges */}
        <div className="flex flex-wrap gap-2 items-center">
          {activeCourts.map((c) => {
            const hrs = week.records
              .filter((r) => r.court === c)
              .reduce((s, r) => s + r.duration, 0);
            return (
              <div
                key={c}
                className={`rounded-xl border px-4 py-2 flex items-center gap-2 ${COURT_COLORS[c] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
              >
                <span className={`w-2 h-2 rounded-full ${COURT_DOT[c] ?? "bg-gray-400"}`} />
                <span className="text-xs font-semibold">Court {c}</span>
                <span className="text-base font-bold ml-1">{hrs}h</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Booking table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Day</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Time</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Court</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Class</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Client</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Coach</th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-center">Students</th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-center">Hrs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap font-medium">
                  {formatDate(r.date)}
                </td>
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                  {r.dayName.slice(0, 3)}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">
                  {r.startTime}–{r.endTime}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-semibold ${
                      COURT_COLORS[r.court] ?? "bg-gray-50 text-gray-600 border-gray-200"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${COURT_DOT[r.court] ?? "bg-gray-400"}`} />
                    Court {r.court}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{r.classType || "–"}</td>
                <td className="px-4 py-2.5 text-gray-800">{r.client || "–"}</td>
                <td className="px-4 py-2.5 text-gray-700">{r.coach || "–"}</td>
                <td className="px-4 py-2.5 text-center text-gray-700">{r.students || "–"}</td>
                <td className="px-4 py-2.5 text-center font-medium text-gray-700">{r.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p className="text-center py-12 text-gray-400">No court bookings this week.</p>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]}`;
}
