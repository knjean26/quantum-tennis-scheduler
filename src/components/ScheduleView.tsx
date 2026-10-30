"use client";
import { useState, useMemo } from "react";
import type { BookingRecord, CoachHoliday, DayRemark } from "@/lib/parse";

interface WeekGroup {
  weekStart: string;
  weekLabel: string;
  records: BookingRecord[];
}

// Fixed row height — each 1-hour slot row; booking cards span multiples of this
const ROW_H = 60; // px

const COACH_COLOR_MAP: Record<string, { bg: string; text: string }> = {
  "Earn":   { bg: "bg-red-500",     text: "text-white" },
  "New":    { bg: "bg-pink-400",    text: "text-white" },
  "Nuttie": { bg: "bg-blue-500",    text: "text-white" },
  "Aoi":    { bg: "bg-indigo-700",  text: "text-white" },
  "Eddy":   { bg: "bg-green-600",   text: "text-white" },
  "Meel":   { bg: "bg-orange-500",  text: "text-white" },
  "Wison":  { bg: "bg-amber-800",   text: "text-white" },
  "Benz":   { bg: "bg-purple-500",  text: "text-white" },
};
const COACH_FALLBACK_PALETTE = [
  { bg: "bg-cyan-600",    text: "text-white" },
  { bg: "bg-teal-600",    text: "text-white" },
  { bg: "bg-lime-600",    text: "text-white" },
  { bg: "bg-fuchsia-600", text: "text-white" },
  { bg: "bg-sky-500",     text: "text-white" },
  { bg: "bg-violet-500",  text: "text-white" },
  { bg: "bg-emerald-600", text: "text-white" },
  { bg: "bg-rose-600",    text: "text-white" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SCHEDULE_TIMES = Array.from({ length: 17 }, (_, i) =>
  `${String(6 + i).padStart(2, "0")}:00`
);

type GridCellData =
  | { kind: "booking"; record: BookingRecord; span: number }
  | { kind: "remark"; remark: DayRemark; span: number };
type GridCell = null | "spanned" | GridCellData;

function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - sh * 60 - sm;
  return mins > 0 ? mins / 60 : 0;
}

function buildDayGrid(records: BookingRecord[], timedRemarks: DayRemark[], allTimes: string[]): GridCell[][] {
  const n = allTimes.length;
  const timeIndex = new Map(allTimes.map((t, i) => [t, i]));
  const grid: GridCell[][] = Array.from({ length: n }, () => [null, null, null, null]);

  const sorted = [...records].sort((a, b) => {
    const tc = a.startTime.localeCompare(b.startTime);
    return tc !== 0 ? tc : b.duration - a.duration;
  });

  for (const record of sorted) {
    const startIdx = timeIndex.get(record.startTime);
    if (startIdx === undefined) continue;
    const span = Math.max(1, Math.ceil(record.duration));
    const slots = Array.from({ length: span }, (_, i) => startIdx + i).filter((i) => i < n);
    for (let col = 0; col < 4; col++) {
      if (slots.every((i) => grid[i][col] === null)) {
        grid[startIdx][col] = { kind: "booking", record, span: slots.length };
        for (let i = 1; i < slots.length; i++) grid[startIdx + i][col] = "spanned";
        break;
      }
    }
  }

  for (const rem of timedRemarks) {
    if (!rem.startTime || !rem.endTime) continue;
    const si = timeIndex.get(rem.startTime);
    if (si === undefined) continue;
    const dur = calcDuration(rem.startTime, rem.endTime);
    const span = Math.max(1, Math.ceil(dur));
    const slots = Array.from({ length: span }, (_, i) => si + i).filter((i) => i < n);
    for (let col = 0; col < 4; col++) {
      if (slots.every((i) => grid[i][col] === null)) {
        grid[si][col] = { kind: "remark", remark: rem, span: slots.length };
        for (let k = 1; k < slots.length; k++) grid[si + k][col] = "spanned";
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

function coachStyle(coach: string) {
  if (!coach) return { bg: "bg-gray-400", text: "text-white" };
  if (COACH_COLOR_MAP[coach]) return COACH_COLOR_MAP[coach];
  let hash = 0;
  for (let i = 0; i < coach.length; i++) hash = (hash * 31 + coach.charCodeAt(i)) & 0xffff;
  return COACH_FALLBACK_PALETTE[hash % COACH_FALLBACK_PALETTE.length];
}

function cardBg(record: BookingRecord): string {
  if (record.client.toLowerCase().includes("parent")) return "bg-blue-50 border-blue-300";
  if (!record.client) return "bg-red-50 border-red-300";
  if (!record.coach) return "bg-gray-100 border-gray-300";
  return "bg-white border-gray-200";
}

function getDayISOs(weekStart: string): Record<string, string> {
  const mon = new Date(weekStart + "T00:00:00");
  const result: Record<string, string> = {};
  DAYS.forEach((day, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    result[day] = `${y}-${mo}-${dd}`;
  });
  return result;
}

export default function ScheduleView({
  weeks,
  defaultWeek = 0,
  holidays = [],
  remarks = [],
}: {
  weeks: WeekGroup[];
  defaultWeek?: number;
  holidays?: CoachHoliday[];
  remarks?: DayRemark[];
}) {
  const [selectedWeek, setSelectedWeek] = useState(defaultWeek);
  const [filterCourt, setFilterCourt] = useState("all");
  const [filterCoach, setFilterCoach] = useState("all");

  const week = weeks[selectedWeek];
  if (!week) return <p className="text-gray-400 p-6">No data.</p>;

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

  const allTimes = SCHEDULE_TIMES;
  const dayDates = useMemo(() => getDayDates(week.weekStart), [week]);
  const dayISOs = useMemo(() => getDayISOs(week.weekStart), [week]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, CoachHoliday[]>();
    for (const h of holidays) {
      if (!map.has(h.date)) map.set(h.date, []);
      map.get(h.date)!.push(h);
    }
    return map;
  }, [holidays]);

  const remarksByDate = useMemo(() => {
    const map = new Map<string, DayRemark>();
    for (const r of remarks) map.set(r.date, r);
    return map;
  }, [remarks]);

  const dayGrids = useMemo(() => {
    const out: Record<string, GridCell[][]> = {};
    for (const day of DAYS) {
      const iso = dayISOs[day] ?? "";
      const timedRemarks = remarks.filter((r) => r.date === iso && r.startTime && r.endTime);
      out[day] = buildDayGrid(filtered.filter((r) => r.dayName === day), timedRemarks, allTimes);
    }
    return out;
  }, [filtered, allTimes, dayISOs, remarks]);

  return (
    <div className="space-y-4">
      {/* Week selector */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">Full Schedule</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSelectedWeek((w) => Math.max(0, w - 1)); setFilterCourt("all"); setFilterCoach("all"); }}
            disabled={selectedWeek === 0}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ‹
          </button>
          <select
            value={selectedWeek}
            onChange={(e) => { setSelectedWeek(Number(e.target.value)); setFilterCourt("all"); setFilterCoach("all"); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {weeks.map((w, i) => (
              <option key={w.weekStart} value={i}>{w.weekLabel}</option>
            ))}
          </select>
          <button
            onClick={() => { setSelectedWeek((w) => Math.min(weeks.length - 1, w + 1)); setFilterCourt("all"); setFilterCoach("all"); }}
            disabled={selectedWeek === weeks.length - 1}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ›
          </button>
        </div>
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
          const s = coachStyle(c);
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
          style={{ tableLayout: "fixed", borderCollapse: "collapse", minWidth: "760px", width: "100%" }}
          className="text-xs"
        >
          <colgroup>
            <col style={{ width: "52px" }} />
            {DAYS.flatMap((_, di) => [
              <col key={`${di}-0`} style={{ width: "72px" }} />,
              <col key={`${di}-1`} style={{ width: "72px" }} />,
              <col key={`${di}-2`} style={{ width: "72px" }} />,
              <col key={`${di}-3`} style={{ width: "72px" }} />,
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
              {/* Day headers with colspan=4 */}
              {DAYS.map((day) => {
                const iso = dayISOs[day] ?? "";
                const dayHolidays = holidaysByDate.get(iso) ?? [];
                // Group by startTime+endTime+note so same-event coaches share one line
                const groupMap = new Map<string, { coaches: string[]; startTime: string; endTime: string; note: string }>();
                for (const h of dayHolidays) {
                  const key = `${h.startTime}|${h.endTime}|${h.note}`;
                  if (!groupMap.has(key)) groupMap.set(key, { coaches: [], startTime: h.startTime, endTime: h.endTime, note: h.note });
                  groupMap.get(key)!.coaches.push(h.coach);
                }
                const allDayGroups = Array.from(groupMap.values()).filter((g) => g.startTime === "All Day");
                const timedGroups = Array.from(groupMap.values()).filter((g) => g.startTime !== "All Day");
                const dayRemarkData = remarksByDate.get(iso);
                return (
                  <th
                    key={day}
                    colSpan={4}
                    style={{ position: "sticky", top: 0, zIndex: 20 }}
                    className="bg-gray-50 border-b border-r border-gray-200 text-center py-1 px-1"
                  >
                    <div className="font-bold text-gray-700 text-sm">{day.slice(0, 3)}</div>
                    <div className="text-[11px] text-gray-400 font-normal">{dayDates[day]}</div>
                    {dayRemarkData && (
                      <div className="mt-0.5 text-[10px] text-amber-700 font-medium truncate px-1 leading-tight bg-amber-50 rounded">
                        {dayRemarkData.startTime ? `${dayRemarkData.startTime}${dayRemarkData.endTime ? `–${dayRemarkData.endTime}` : ""} · ` : ""}{dayRemarkData.remark}
                      </div>
                    )}
                    {allDayGroups.map((g, i) => (
                      <div key={i} className="mt-0.5 text-[9px] text-red-700 bg-red-100 rounded px-1 leading-tight truncate">
                        {g.coaches.join(", ")}: {g.note || "off"}
                      </div>
                    ))}
                    {timedGroups.map((g, i) => (
                      <div key={`t${i}`} className="mt-0.5 text-[9px] text-amber-700 bg-amber-100 rounded px-1 leading-tight truncate">
                        {g.startTime}–{g.endTime}: {g.coaches.join(", ")}
                      </div>
                    ))}
                  </th>
                );
              })}
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
                {/* Day cells: 4 sub-cols each */}
                {DAYS.map((day, di) => {
                  const dayGrid = dayGrids[day];
                  return [0, 1, 2, 3].map((col) => {
                    const cell = dayGrid[timeIdx]?.[col];
                    if (cell === "spanned") return null;
                    const span = cell ? cell.span : 1;
                    return (
                      <td
                        key={`${day}-${col}`}
                        rowSpan={span}
                        style={{ overflow: "hidden" }}
                        className={`p-0.5 align-top border-b border-gray-100 ${col === 3 && di < 6 ? "border-r border-gray-200" : col < 3 ? "border-r border-gray-100" : ""}`}
                      >
                        {cell?.kind === "booking" && (
                          <BookingCard record={cell.record} span={span} />
                        )}
                        {cell?.kind === "remark" && (
                          <RemarkCard remark={cell.remark} span={span} />
                        )}
                      </td>
                    );
                  });
                })}
              </tr>
            ))}
          </tbody>
        </table>
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
}: {
  record: BookingRecord;
  span: number;
}) {
  const cs = coachStyle(r.coach);
  const bg = cardBg(r);

  return (
    <div
      className={`w-full rounded border ${bg} overflow-hidden`}
      style={{ height: `${span * ROW_H - 2}px` }}
    >
      <div className="px-1 pt-1 pb-0.5 overflow-hidden">
        <div className="flex items-center gap-0.5 mb-0.5 flex-wrap">
          {r.court && (
            <span className="inline-block rounded bg-gray-700 text-white text-[9px] font-bold px-1 leading-tight">
              C{r.court}
            </span>
          )}
          {r.students > 0 && (
            <span className="inline-block rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1 leading-tight">
              {r.students}s
            </span>
          )}
        </div>
        <div className={`font-medium text-[9px] leading-tight break-words w-full overflow-hidden ${r.remark === "ยังไม่ได้จ่ายเงิน" ? "text-orange-500" : "text-gray-800"}`} style={{ wordBreak: "break-word" }}>
          {r.client || <span className="text-red-400 italic">–</span>}
        </div>
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

function RemarkCard({ remark: r, span }: { remark: DayRemark; span: number }) {
  return (
    <div
      className="w-full rounded border border-amber-300 bg-amber-50 overflow-hidden"
      style={{ height: `${span * ROW_H - 2}px` }}
    >
      <div className="px-1 pt-1 pb-0.5">
        <div className="text-[9px] text-amber-600 leading-tight font-medium">Remark</div>
        <div className="text-[9px] font-bold text-amber-800 leading-tight truncate">{r.remark}</div>
        {r.startTime && r.endTime && (
          <div className="mt-0.5 text-[8px] text-amber-500 leading-tight">{r.startTime}–{r.endTime}</div>
        )}
      </div>
    </div>
  );
}
