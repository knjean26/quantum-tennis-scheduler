"use client";
import { useState, useMemo } from "react";
import type { BookingRecord } from "@/lib/parse";

interface WeekGroup {
  weekStart: string;
  weekLabel: string;
  records: BookingRecord[];
}

// Fixed row height — each 1-hour slot row; booking cards span multiples of this
const ROW_H = 60; // px

// 12-color palette for coaches
const COACH_PALETTE = [
  { bg: "bg-blue-500",    text: "text-white" },
  { bg: "bg-emerald-500", text: "text-white" },
  { bg: "bg-amber-500",   text: "text-white" },
  { bg: "bg-purple-500",  text: "text-white" },
  { bg: "bg-rose-500",    text: "text-white" },
  { bg: "bg-cyan-600",    text: "text-white" },
  { bg: "bg-orange-500",  text: "text-white" },
  { bg: "bg-indigo-500",  text: "text-white" },
  { bg: "bg-pink-500",    text: "text-white" },
  { bg: "bg-teal-600",    text: "text-white" },
  { bg: "bg-lime-600",    text: "text-white" },
  { bg: "bg-fuchsia-600", text: "text-white" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type GridCell =
  | null
  | "spanned"
  | { record: BookingRecord; span: number };

// Assign up to 3 sub-columns per time slot, with rowspan for multi-hour bookings
function buildDayGrid(records: BookingRecord[], allTimes: string[]): GridCell[][] {
  const n = allTimes.length;
  const timeIndex = new Map(allTimes.map((t, i) => [t, i]));
  // grid[timeIdx][subCol 0..2]
  const grid: GridCell[][] = Array.from({ length: n }, () => [null, null, null]);

  const sorted = [...records].sort((a, b) => {
    const tc = a.startTime.localeCompare(b.startTime);
    return tc !== 0 ? tc : b.duration - a.duration;
  });

  for (const record of sorted) {
    const startIdx = timeIndex.get(record.startTime);
    if (startIdx === undefined) continue;
    const span = Math.max(1, Math.ceil(record.duration));
    const slots = Array.from({ length: span }, (_, i) => startIdx + i).filter((i) => i < n);

    for (let col = 0; col < 3; col++) {
      if (slots.every((i) => grid[i][col] === null)) {
        grid[startIdx][col] = { record, span: slots.length };
        for (let i = 1; i < slots.length; i++) grid[startIdx + i][col] = "spanned";
        break;
      }
    }
  }
  return grid;
}

function getAllTimes(records: BookingRecord[]): string[] {
  if (!records.length) return [];
  let minH = 24, maxH = 0;
  for (const r of records) {
    const [sh] = r.startTime.split(":").map(Number);
    const [eh] = r.endTime.split(":").map(Number);
    minH = Math.min(minH, sh);
    maxH = Math.max(maxH, eh);
  }
  return Array.from({ length: maxH - minH }, (_, i) =>
    `${String(minH + i).padStart(2, "0")}:00`
  );
}

function getDayDates(weekStart: string): Record<string, string> {
  const mon = new Date(weekStart + "T00:00:00");
  const result: Record<string, string> = {};
  DAYS.forEach((day, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    result[day] = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  });
  return result;
}

function coachStyle(coach: string, indexMap: Map<string, number>) {
  if (!coach) return { bg: "bg-gray-400", text: "text-white" };
  const idx = indexMap.get(coach) ?? 0;
  return COACH_PALETTE[idx % COACH_PALETTE.length];
}

function cardBg(record: BookingRecord): string {
  if (record.client.toLowerCase().includes("parent")) return "bg-blue-50 border-blue-300";
  if (!record.client) return "bg-red-50 border-red-300";
  if (!record.coach) return "bg-gray-100 border-gray-300";
  return "bg-white border-gray-200";
}

export default function ScheduleView({
  weeks,
  defaultWeek = 0,
}: {
  weeks: WeekGroup[];
  defaultWeek?: number;
}) {
  const [selectedWeek, setSelectedWeek] = useState(defaultWeek);
  const [filterCourt, setFilterCourt] = useState("all");
  const [filterCoach, setFilterCoach] = useState("all");

  const week = weeks[selectedWeek];
  if (!week) return <p className="text-gray-400 p-6">No data.</p>;

  const coachIndexMap = useMemo(() => {
    const coaches = [...new Set(week.records.map((r) => r.coach).filter(Boolean))].sort();
    return new Map(coaches.map((c, i) => [c, i]));
  }, [week]);

  const allCoaches = useMemo(
    () => [...new Set(week.records.map((r) => r.coach).filter(Boolean))].sort(),
    [week]
  );
  const allCourts = useMemo(
    () => [...new Set(week.records.map((r) => r.court).filter(Boolean))].sort(),
    [week]
  );

  const filtered = week.records.filter((r) => {
    if (filterCourt !== "all" && r.court !== filterCourt) return false;
    if (filterCoach !== "all" && r.coach !== filterCoach) return false;
    return true;
  });

  const allTimes = useMemo(() => getAllTimes(filtered.length ? filtered : week.records), [filtered, week]);
  const dayDates = useMemo(() => getDayDates(week.weekStart), [week]);

  const dayGrids = useMemo(() => {
    const out: Record<string, GridCell[][]> = {};
    for (const day of DAYS) {
      out[day] = buildDayGrid(filtered.filter((r) => r.dayName === day), allTimes);
    }
    return out;
  }, [filtered, allTimes]);

  return (
    <div className="space-y-4">
      {/* Week selector */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">Full Schedule</h1>
        <select
          value={selectedWeek}
          onChange={(e) => { setSelectedWeek(Number(e.target.value)); setFilterCourt("all"); setFilterCoach("all"); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {weeks.map((w, i) => (
            <option key={w.weekStart} value={i}>{w.weekLabel}</option>
          ))}
        </select>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterCoach}
          onChange={(e) => setFilterCoach(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">All Coaches</option>
          {allCoaches.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterCourt}
          onChange={(e) => setFilterCourt(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">All Courts</option>
          {allCourts.map((c) => <option key={c} value={c}>Court {c}</option>)}
        </select>
      </div>

      {/* Coach legend */}
      <div className="flex flex-wrap gap-1.5">
        {allCoaches.map((c) => {
          const s = coachStyle(c, coachIndexMap);
          const active = filterCoach === "all" || filterCoach === c;
          return (
            <button
              key={c}
              onClick={() => setFilterCoach(filterCoach === c ? "all" : c)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-opacity ${s.bg} ${s.text} ${active ? "" : "opacity-30"}`}
            >
              {c}
            </button>
          );
        })}
        <span className="text-xs text-gray-400 self-center ml-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-100 border border-blue-300 align-middle mr-0.5" /> Parent
          <span className="inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-300 align-middle mx-0.5 ml-2" /> No client
          <span className="inline-block w-3 h-3 rounded-sm bg-gray-100 border border-gray-300 align-middle mx-0.5 ml-2" /> No coach
        </span>
      </div>

      {/* Timetable */}
      <div
        className="rounded-xl border border-gray-200 shadow-sm bg-white"
        style={{ overflow: "auto", maxHeight: "calc(100vh - 220px)" }}
      >
        <table
          style={{ tableLayout: "fixed", borderCollapse: "collapse", minWidth: "760px" }}
          className="text-xs"
        >
          <colgroup>
            <col style={{ width: "52px" }} />
            {DAYS.flatMap((_, di) => [
              <col key={`${di}-0`} style={{ width: "48px" }} />,
              <col key={`${di}-1`} style={{ width: "48px" }} />,
              <col key={`${di}-2`} style={{ width: "48px" }} />,
            ])}
          </colgroup>
          <thead>
            <tr className="bg-gray-50">
              {/* Top-left corner: sticky top + sticky left */}
              <th
                style={{ position: "sticky", top: 0, left: 0, zIndex: 30 }}
                className="bg-gray-50 border-b border-r border-gray-200 px-1 py-2"
              >
                <span className="text-sm font-bold text-gray-500">Time</span>
              </th>
              {/* Day headers with colspan=3 */}
              {DAYS.map((day) => (
                <th
                  key={day}
                  colSpan={3}
                  style={{ position: "sticky", top: 0, zIndex: 20 }}
                  className="bg-gray-50 border-b border-r border-gray-200 text-center py-2 px-1"
                >
                  <div className="font-bold text-gray-700 text-sm">{day.slice(0, 3)}</div>
                  <div className="text-[11px] text-gray-400 font-normal">{dayDates[day]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allTimes.map((time, timeIdx) => (
              <tr key={time} style={{ height: `${ROW_H}px` }} className={timeIdx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}>
                {/* Sticky time cell */}
                <td
                  style={{ position: "sticky", left: 0, zIndex: 10, height: `${ROW_H}px` }}
                  className={`border-r border-b border-gray-200 px-1 text-center align-middle ${timeIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                >
                  <div className="flex flex-col items-center justify-center leading-tight">
                    <span className="text-sm font-bold text-gray-700">{time}</span>
                    <span className="text-[10px] text-gray-400">{nextHour(time)}</span>
                  </div>
                </td>
                {/* Day cells: 3 sub-cols each */}
                {DAYS.map((day, di) => {
                  const dayGrid = dayGrids[day];
                  return [0, 1, 2].map((col) => {
                    const cell = dayGrid[timeIdx]?.[col];
                    if (cell === "spanned") return null;
                    const booking = cell && cell !== "spanned" ? cell : null;
                    const span = booking ? booking.span : 1;
                    const record = booking ? booking.record : null;
                    return (
                      <td
                        key={`${day}-${col}`}
                        rowSpan={span}
                        style={{ overflow: "hidden", maxWidth: "48px" }}
                        className={`p-0.5 align-top border-b border-gray-100 ${col === 2 && di < 6 ? "border-r border-gray-200" : col < 2 ? "border-r border-gray-100" : ""}`}
                      >
                        {record && (
                          <BookingCard
                            record={record}
                            span={span}
                            coachIndexMap={coachIndexMap}
                          />
                        )}
                      </td>
                    );
                  });
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {allTimes.length === 0 && (
          <p className="text-center py-12 text-gray-400 text-sm">No bookings.</p>
        )}
      </div>
    </div>
  );
}

function nextHour(t: string): string {
  const [h] = t.split(":").map(Number);
  return `${String(h + 1).padStart(2, "0")}:00`;
}

function BookingCard({
  record: r,
  span,
  coachIndexMap,
}: {
  record: BookingRecord;
  span: number;
  coachIndexMap: Map<string, number>;
}) {
  const cs = coachStyle(r.coach, coachIndexMap);
  const bg = cardBg(r);

  return (
    <div
      className={`w-full rounded border ${bg} overflow-hidden`}
      style={{ height: `${span * ROW_H - 2}px` }}
    >
      <div className="px-1 pt-1 pb-0.5 overflow-hidden">
        {/* Court badge */}
        {r.court && (
          <span className="inline-block rounded bg-gray-700 text-white text-[9px] font-bold px-1 leading-tight mb-0.5">
            C{r.court}
          </span>
        )}
        {/* Client name — truncated to fit */}
        <div className="font-semibold text-[11px] leading-tight text-gray-800 truncate w-full">
          {r.client || <span className="text-red-400 italic">–</span>}
        </div>
        {/* Coach badge — truncated */}
        {r.coach ? (
          <div className={`mt-0.5 rounded px-1 text-[9px] font-semibold leading-tight truncate max-w-full ${cs.bg} ${cs.text}`}>
            {r.coach}
          </div>
        ) : (
          <div className="mt-0.5 rounded px-1 text-[9px] font-medium leading-tight bg-gray-300 text-gray-600">
            –
          </div>
        )}
      </div>
    </div>
  );
}
