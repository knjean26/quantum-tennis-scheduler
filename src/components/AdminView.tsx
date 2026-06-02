"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { parseAdminBookings, groupByWeek } from "@/lib/parse";
import type { AdminBooking } from "@/lib/parse";
import BookingFormModal from "./BookingFormModal";
import type { BookingFormData } from "./BookingFormModal";
import CopyBookingModal from "./CopyBookingModal";
import RateCardEditor from "./RateCardEditor";

const ROW_H = 60;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const COACH_PALETTE = [
  { bg: "bg-blue-500", text: "text-white" },
  { bg: "bg-emerald-500", text: "text-white" },
  { bg: "bg-amber-500", text: "text-white" },
  { bg: "bg-purple-500", text: "text-white" },
  { bg: "bg-rose-500", text: "text-white" },
  { bg: "bg-cyan-600", text: "text-white" },
  { bg: "bg-orange-500", text: "text-white" },
  { bg: "bg-indigo-500", text: "text-white" },
  { bg: "bg-pink-500", text: "text-white" },
  { bg: "bg-teal-600", text: "text-white" },
  { bg: "bg-lime-600", text: "text-white" },
  { bg: "bg-fuchsia-600", text: "text-white" },
];

type GridCell = null | "spanned" | { record: AdminBooking; span: number };

function buildGrid(records: AdminBooking[], allTimes: string[]): GridCell[][] {
  const n = allTimes.length;
  const timeIdx = new Map(allTimes.map((t, i) => [t, i]));
  const grid: GridCell[][] = Array.from({ length: n }, () => [null, null, null]);
  const sorted = [...records].sort((a, b) => {
    const tc = a.startTime.localeCompare(b.startTime);
    return tc !== 0 ? tc : b.duration - a.duration;
  });
  for (const record of sorted) {
    const si = timeIdx.get(record.startTime);
    if (si === undefined) continue;
    const span = Math.max(1, Math.ceil(record.duration));
    const slots = Array.from({ length: span }, (_, i) => si + i).filter((i) => i < n);
    for (let col = 0; col < 3; col++) {
      if (slots.every((i) => grid[i][col] === null)) {
        grid[si][col] = { record, span: slots.length };
        for (let i = 1; i < slots.length; i++) grid[si + i][col] = "spanned";
        break;
      }
    }
  }
  return grid;
}

function getAllTimes(records: AdminBooking[]): string[] {
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

function getDateForDay(weekStart: string, dayName: string): string {
  const offset = DAYS.indexOf(dayName);
  const mon = new Date(weekStart + "T00:00:00");
  const d = new Date(mon);
  d.setDate(mon.getDate() + offset);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function coachStyle(coach: string, indexMap: Map<string, number>) {
  if (!coach) return { bg: "bg-gray-400", text: "text-white" };
  const idx = indexMap.get(coach) ?? 0;
  return COACH_PALETTE[idx % COACH_PALETTE.length];
}

const SCHEDULE_TIMES = Array.from({ length: 17 }, (_, i) =>
  `${String(6 + i).padStart(2, "0")}:00`
);

// Price/fee columns (7,9,46-50,52) have Google Sheets formulas — never overwrite them.
const MANAGED_COLS = [0, 1, 2, 3, 4, 5, 6, 8, 43, 45, 59, 60];

function formDataToRow(data: BookingFormData): string[] {
  const row = Array(61).fill("");
  if (data.date) {
    const [y, mo, d] = data.date.split("-");
    row[0] = `${d}/${mo}/${y}`;
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    row[1] = dayNames[new Date(data.date + "T00:00:00").getDay()];
  }
  row[2] = data.startTime;
  row[3] = data.endTime;
  row[4] = data.court;
  row[5] = data.classType;
  row[6] = data.classValue;
  row[8] = data.students;
  row[43] = data.client;
  row[45] = data.coachName;
  row[59] = data.remark;
  row[60] = data.confirmed ? "Confirmed" : "";
  return row;
}

function formDataToFieldMap(data: BookingFormData): Record<number, string> {
  const row = formDataToRow(data);
  return Object.fromEntries(MANAGED_COLS.map((c) => [c, row[c]]));
}

interface AdminData {
  rows: { rowIndex: number; values: string[] }[];
  dropdowns: { classTypes: string[]; clients: string[]; coaches: string[]; courts: string[] };
  rateCard: string[][];
  coachRateCard: string[][];
}

type Tab = "schedule" | "ratecard" | "coachratecard";
type FormState =
  | { mode: "add"; prefill?: { date?: string; startTime?: string } }
  | { mode: "edit"; booking: AdminBooking }
  | { mode: "copy"; booking: AdminBooking };

export default function AdminView() {
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const hasInitialized = useRef(false);
  const pendingWeekRef = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/data");
      if (!res.ok) throw new Error(`API error ${res.status}`);
      setAdminData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const parsedBookings = useMemo(
    () => (adminData ? parseAdminBookings(adminData.rows) : []),
    [adminData]
  );

  const weeks = useMemo(() => groupByWeek(parsedBookings), [parsedBookings]);

  useEffect(() => {
    if (!weeks.length) return;
    // After an add, jump to the week containing the new booking
    if (pendingWeekRef.current) {
      const idx = weeks.findIndex((w) => w.weekStart === pendingWeekRef.current);
      if (idx !== -1) setSelectedWeek(idx);
      pendingWeekRef.current = null;
      hasInitialized.current = true;
      return;
    }
    // On first load only, jump to the current week
    if (hasInitialized.current) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    let idx = 0;
    for (let i = 0; i < weeks.length; i++) {
      if (weeks[i].weekStart <= today) idx = i;
      else break;
    }
    setSelectedWeek(idx);
    hasInitialized.current = true;
  }, [weeks]);

  const currentWeek = weeks[selectedWeek];

  const allTimes = SCHEDULE_TIMES;

  const dayDates = useMemo(
    () => (currentWeek ? getDayDates(currentWeek.weekStart) : {}),
    [currentWeek]
  );

  const coachIndexMap = useMemo(() => {
    if (!currentWeek) return new Map<string, number>();
    const coaches = [...new Set(currentWeek.records.map((r) => r.coach).filter(Boolean))].sort();
    return new Map(coaches.map((c, i) => [c, i]));
  }, [currentWeek]);

  const dayGrids = useMemo(() => {
    if (!currentWeek) return {} as Record<string, GridCell[][]>;
    const out: Record<string, GridCell[][]> = {};
    for (const day of DAYS) {
      out[day] = buildGrid(
        currentWeek.records.filter((r) => r.dayName === day),
        allTimes
      );
    }
    return out;
  }, [currentWeek, allTimes]);

  async function handleSave(data: BookingFormData) {
    if (!formState) return;
    setSaving(true);
    try {
      if (formState.mode === "add") {
        const values = formDataToRow(data);
        const res = await fetch("/api/admin/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values }),
        });
        if (!res.ok) throw new Error("Failed to add booking");
        // Store the booking's week so we navigate there after reload
        if (data.date) {
          const d = new Date(data.date + "T00:00:00");
          const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
          d.setDate(d.getDate() + diff);
          pendingWeekRef.current = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }
      } else {
        const fieldMap = formDataToFieldMap(data);
        const res = await fetch("/api/admin/booking", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rowIndex: formState.booking.rowIndex, fieldMap }),
        });
        if (!res.ok) throw new Error("Failed to update booking");
      }
      setFormState(null);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (formState?.mode !== "edit") return;
    if (!confirm("Delete this booking? This cannot be undone.")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/booking", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: formState.booking.rowIndex }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      setFormState(null);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy(booking: AdminBooking, dates: string[]) {
    setSaving(true);
    try {
      for (const date of dates) {
        const row = [...booking.raw];
        while (row.length < 53) row.push("");
        const [y, mo, d] = date.split("-");
        row[0] = `${d}/${mo}/${y}`;
        const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        row[1] = dayNames[new Date(date + "T00:00:00").getDay()];
        const res = await fetch("/api/admin/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: row }),
        });
        if (!res.ok) throw new Error("Failed to copy booking");
      }
      // Navigate to the week of the first copied date
      if (dates[0]) {
        const d = new Date(dates[0] + "T00:00:00");
        const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
        d.setDate(d.getDate() + diff);
        pendingWeekRef.current = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
      setFormState(null);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRateCard(rows: string[][]) {
    const res = await fetch("/api/admin/rate-card", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) throw new Error("Failed to save Rate Card");
    await loadData();
  }

  async function handleSaveCoachRateCard(rows: string[][]) {
    const res = await fetch("/api/admin/coach-rate-card", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) throw new Error("Failed to save Coach Rate Card");
    await loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">Loading admin data…</div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        <p className="font-semibold">Error loading data</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={loadData} className="mt-3 text-sm underline">Retry</button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "schedule", label: "Schedule" },
    { key: "ratecard", label: "Rate Card" },
    { key: "coachratecard", label: "Coach Rate Card" },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Schedule tab */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-800">Admin Schedule</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedWeek((w) => Math.max(0, w - 1))}
                disabled={selectedWeek === 0}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm shadow-sm hover:bg-gray-50 disabled:opacity-40"
              >
                ‹
              </button>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {weeks.map((w, i) => (
                  <option key={w.weekStart} value={i}>{w.weekLabel}</option>
                ))}
              </select>
              <button
                onClick={() => setSelectedWeek((w) => Math.min(weeks.length - 1, w + 1))}
                disabled={selectedWeek === weeks.length - 1}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm shadow-sm hover:bg-gray-50 disabled:opacity-40"
              >
                ›
              </button>
              <button
                onClick={() => setFormState({ mode: "add" })}
                className="ml-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-1.5"
              >
                + Add Booking
              </button>
            </div>
          </div>

          {/* Grid */}
          <div
            className="rounded-xl border border-gray-200 shadow-sm bg-white"
            style={{ overflow: "auto", maxHeight: "calc(100vh - 200px)" }}
          >
            {!currentWeek ? (
              <p className="text-center py-12 text-gray-400 text-sm">No data for this week.</p>
            ) : (
              <table
                style={{ tableLayout: "fixed", borderCollapse: "collapse", minWidth: "760px", width: "100%" }}
                className="text-xs"
              >
                <colgroup>
                  <col style={{ width: "52px" }} />
                  {DAYS.flatMap((_, di) => [
                    <col key={`${di}-0`} style={{ width: "80px" }} />,
                    <col key={`${di}-1`} style={{ width: "80px" }} />,
                    <col key={`${di}-2`} style={{ width: "80px" }} />,
                  ])}
                </colgroup>
                <thead>
                  <tr className="bg-gray-50">
                    <th
                      style={{ position: "sticky", top: 0, left: 0, zIndex: 30 }}
                      className="bg-gray-50 border-b border-r border-gray-200 px-1 py-2"
                    >
                      <span className="text-sm font-bold text-gray-500">Time</span>
                    </th>
                    {DAYS.map((day) => (
                      <th
                        key={day}
                        colSpan={3}
                        style={{ position: "sticky", top: 0, zIndex: 20 }}
                        className="bg-gray-50 border-b border-r border-gray-200 text-center py-2 px-1"
                      >
                        <div className="font-bold text-gray-700 text-sm">{day.slice(0, 3)}</div>
                        <div className="text-[11px] text-gray-400">{dayDates[day]}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allTimes.map((time, timeIdx) => (
                    <tr
                      key={time}
                      style={{ height: `${ROW_H}px` }}
                      className={timeIdx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}
                    >
                      <td
                        style={{ position: "sticky", left: 0, zIndex: 10, height: `${ROW_H}px` }}
                        className={`border-r border-b border-gray-200 px-1 text-center align-middle ${timeIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                      >
                        <div className="flex flex-col items-center justify-center leading-tight">
                          <span className="text-sm font-bold text-gray-700">{time}</span>
                          <span className="text-[10px] text-gray-400">
                            {`${String(parseInt(time) + 1).padStart(2, "0")}:00`}
                          </span>
                        </div>
                      </td>
                      {DAYS.map((day, di) => {
                        const dayGrid = dayGrids[day] ?? [];
                        return [0, 1, 2].map((col) => {
                          const cell = dayGrid[timeIdx]?.[col];
                          if (cell === "spanned") return null;
                          const booking = cell ?? null;
                          const span = booking ? booking.span : 1;
                          const record = booking ? booking.record : null;
                          return (
                            <td
                              key={`${day}-${col}`}
                              rowSpan={span}
                              style={{ overflow: "hidden" }}
                              className={`p-0.5 align-top border-b border-gray-100 ${col === 2 && di < 6 ? "border-r border-gray-200" : col < 2 ? "border-r border-gray-100" : ""} ${!record ? "cursor-pointer hover:bg-emerald-50/50 group" : ""}`}
                              onClick={
                                !record
                                  ? () => {
                                      const date = getDateForDay(currentWeek.weekStart, day);
                                      setFormState({ mode: "add", prefill: { date, startTime: time } });
                                    }
                                  : undefined
                              }
                            >
                              {record ? (
                                <AdminCard
                                  record={record}
                                  span={span}
                                  coachIndexMap={coachIndexMap}
                                  onClick={() => setFormState({ mode: "edit", booking: record })}
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-emerald-400 text-base font-thin select-none">
                                  +
                                </div>
                              )}
                            </td>
                          );
                        });
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Rate Card tab */}
      {activeTab === "ratecard" && adminData && (
        <RateCardEditor
          title="Rate Card"
          rows={adminData.rateCard}
          onSave={handleSaveRateCard}
        />
      )}

      {/* Coach Rate Card tab */}
      {activeTab === "coachratecard" && adminData && (
        <RateCardEditor
          title="Coach Rate Card"
          rows={adminData.coachRateCard}
          onSave={handleSaveCoachRateCard}
        />
      )}

      {/* Booking Modal */}
      {formState && formState.mode !== "copy" && adminData && (
        <BookingFormModal
          mode={formState.mode}
          booking={formState.mode === "edit" ? formState.booking : undefined}
          prefill={formState.mode === "add" ? formState.prefill : undefined}
          dropdowns={adminData.dropdowns}
          rateCard={adminData.rateCard}
          coachRateCard={adminData.coachRateCard}
          onSave={handleSave}
          onDelete={formState.mode === "edit" ? handleDelete : undefined}
          onCopy={formState.mode === "edit" ? () => setFormState({ mode: "copy", booking: formState.booking }) : undefined}
          onClose={() => setFormState(null)}
          saving={saving}
        />
      )}

      {/* Copy Modal */}
      {formState?.mode === "copy" && (
        <CopyBookingModal
          booking={formState.booking}
          onCopy={(dates) => handleCopy(formState.booking, dates)}
          onClose={() => setFormState(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

function AdminCard({
  record: r,
  span,
  coachIndexMap,
  onClick,
}: {
  record: AdminBooking;
  span: number;
  coachIndexMap: Map<string, number>;
  onClick: () => void;
}) {
  const cs = coachStyle(r.coach, coachIndexMap);
  const bg =
    r.remark === "Cancel"
      ? "bg-red-200 border-red-500"
      : r.remark === "ยังไม่มีนักเรียน"
      ? "bg-red-100 border-red-400"
      : r.remark === "ยังไม่ได้จ่ายเงิน"
      ? "bg-orange-50 border-orange-300"
      : r.remark === "Payment Requested"
      ? "bg-yellow-50 border-yellow-400"
      : r.remark === "จองสนามเอง" && !r.coach
      ? "bg-purple-100 border-purple-400"
      : r.client?.toLowerCase().includes("parent")
      ? "bg-blue-50 border-blue-300"
      : !r.client
      ? "bg-red-50 border-red-300"
      : !r.coach
      ? "bg-gray-100 border-gray-300"
      : "bg-white border-gray-200";

  return (
    <div
      onClick={onClick}
      className={`w-full rounded border ${bg} overflow-hidden cursor-pointer group/card relative hover:ring-2 hover:ring-emerald-400 transition-shadow`}
      style={{ height: `${span * ROW_H - 2}px` }}
    >
      <div className="px-1 pt-1 pb-0.5 overflow-hidden">
        <div className="flex items-center gap-0.5 mb-0.5 flex-wrap">
          {r.court && (
            <span className="inline-flex items-center gap-0.5 rounded bg-gray-700 text-white text-[9px] font-bold px-1 leading-tight">
              C{r.court}{r.remark === "DONE" && <span className="text-green-300">✓</span>}
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
          <div className="mt-0.5 rounded px-1 text-[9px] font-medium leading-tight bg-gray-300 text-gray-600">–</div>
        )}
        {r.remark && r.remark !== "DONE" && (
          <div className={`mt-0.5 rounded px-1 text-[9px] font-medium leading-tight truncate max-w-full ${
            r.remark === "ยังไม่ได้จ่ายเงิน" ? "bg-orange-100 text-orange-600"
            : r.remark === "ยังไม่มีนักเรียน" ? "bg-red-200 text-red-700"
            : r.remark === "Cancel" ? "bg-red-300 text-red-800"
            : r.remark === "Payment Requested" ? "bg-yellow-100 text-yellow-700"
            : r.remark === "จองสนามเอง" ? "bg-purple-200 text-purple-700"
            : r.remark === "ขายสนาม" ? "bg-amber-200 text-amber-700"
            : "bg-gray-200 text-gray-600"
          }`}>
            {r.remark}
          </div>
        )}
        {r.confirmed && (
          <div className="mt-0.5 rounded px-1 text-[9px] font-medium leading-tight bg-green-100 text-green-800">
            Confirmed
          </div>
        )}
      </div>
      <div className="absolute top-0.5 right-0.5 opacity-0 group-hover/card:opacity-100 bg-white/90 rounded-full p-0.5 shadow-sm">
        <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
      </div>
    </div>
  );
}
