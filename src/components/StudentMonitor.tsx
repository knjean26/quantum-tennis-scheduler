"use client";
import { useMemo, useState } from "react";
import type { AdminBooking } from "@/lib/parse";

const WINDOWS = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
] as const;

type WindowDays = (typeof WINDOWS)[number]["days"];
type StatusFilter = "all" | "new" | "active" | "at-risk" | "inactive";
type SortKey = "lastDate" | "name" | "sessions";

interface StudentRow {
  name: string;
  firstDate: string;
  lastDate: string;
  daysSinceLast: number;
  totalSessions: number;
  windowSessions: number;
  topClass: string;
  topCoach: string;
  status: "new" | "active" | "at-risk" | "inactive";
}

function buildRows(
  bookings: AdminBooking[],
  windowDays: number,
  filterCoach: string,
  filterClass: string
): StudentRow[] {
  const valid = bookings.filter((b) => b.remark !== "Cancel" && !!b.client);

  const now = Date.now();
  const windowCutoff = now - windowDays * 86400000;
  // "At risk" = active but last session older than 2/3 of window
  const atRiskCutoff = now - Math.round(windowDays * 0.67) * 86400000;

  const map = new Map<string, AdminBooking[]>();
  for (const b of valid) {
    const arr = map.get(b.client) ?? [];
    arr.push(b);
    map.set(b.client, arr);
  }

  const rows: StudentRow[] = [];
  for (const [name, allRecords] of map) {
    const records = allRecords.filter(
      (r) =>
        (!filterCoach || r.coach === filterCoach) &&
        (!filterClass || r.classType === filterClass)
    );
    if (records.length === 0) continue;

    const dates = records.map((r) => r.date).sort();
    const firstMs = new Date(dates[0] + "T00:00:00").getTime();
    const lastMs = new Date(dates[dates.length - 1] + "T00:00:00").getTime();
    const daysSinceLast = Math.max(0, Math.floor((now - lastMs) / 86400000));
    const windowSessions = records.filter(
      (r) => new Date(r.date + "T00:00:00").getTime() >= windowCutoff
    ).length;

    const classCounts: Record<string, number> = {};
    const coachCounts: Record<string, number> = {};
    for (const r of records) {
      if (r.classType) classCounts[r.classType] = (classCounts[r.classType] ?? 0) + 1;
      if (r.coach) coachCounts[r.coach] = (coachCounts[r.coach] ?? 0) + 1;
    }
    const topClass = Object.entries(classCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const topCoach = Object.entries(coachCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

    const isActive = lastMs >= windowCutoff;
    const isNew = firstMs >= windowCutoff;
    const isAtRisk = isActive && !isNew && lastMs < atRiskCutoff;

    let status: StudentRow["status"];
    if (isNew) status = "new";
    else if (!isActive) status = "inactive";
    else if (isAtRisk) status = "at-risk";
    else status = "active";

    rows.push({
      name,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
      daysSinceLast,
      totalSessions: records.length,
      windowSessions,
      topClass,
      topCoach,
      status,
    });
  }

  return rows;
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function StudentMonitor({ bookings }: { bookings: AdminBooking[] }) {
  const [windowDays, setWindowDays] = useState<WindowDays>(90);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filterCoach, setFilterCoach] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("lastDate");

  const coaches = useMemo(
    () =>
      [...new Set(bookings.filter((b) => b.remark !== "Cancel" && b.coach).map((b) => b.coach))].sort(),
    [bookings]
  );
  const classTypes = useMemo(
    () =>
      [...new Set(bookings.filter((b) => b.remark !== "Cancel" && b.classType).map((b) => b.classType))].sort(),
    [bookings]
  );

  const allRows = useMemo(
    () => buildRows(bookings, windowDays, filterCoach, filterClass),
    [bookings, windowDays, filterCoach, filterClass]
  );

  const counts = useMemo(
    () => ({
      new: allRows.filter((r) => r.status === "new").length,
      active: allRows.filter((r) => r.status === "active").length,
      atRisk: allRows.filter((r) => r.status === "at-risk").length,
      inactive: allRows.filter((r) => r.status === "inactive").length,
    }),
    [allRows]
  );

  const displayed = useMemo(() => {
    let rows = allRows;
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "sessions") return b.totalSessions - a.totalSessions;
      return b.lastDate.localeCompare(a.lastDate);
    });
  }, [allRows, statusFilter, search, sortBy]);

  const windowLabel = WINDOWS.find((w) => w.days === windowDays)?.label ?? "3M";
  const hasFilters = statusFilter !== "all" || filterCoach || filterClass || search;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">Student Monitor</h2>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              onClick={() => setWindowDays(w.days)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                windowDays === w.days
                  ? "bg-white text-emerald-700 shadow-sm font-semibold"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="Active"
          sublabel={`returned within ${windowLabel}`}
          value={counts.active}
          color="emerald"
          pressed={statusFilter === "active"}
          onClick={() => setStatusFilter((s) => (s === "active" ? "all" : "active"))}
        />
        <SummaryCard
          label="New"
          sublabel={`first session within ${windowLabel}`}
          value={counts.new}
          color="blue"
          pressed={statusFilter === "new"}
          onClick={() => setStatusFilter((s) => (s === "new" ? "all" : "new"))}
        />
        <SummaryCard
          label="At Risk"
          sublabel="active but fading"
          value={counts.atRisk}
          color="amber"
          pressed={statusFilter === "at-risk"}
          onClick={() => setStatusFilter((s) => (s === "at-risk" ? "all" : "at-risk"))}
        />
        <SummaryCard
          label="Inactive"
          sublabel={`no session in ${windowLabel}+`}
          value={counts.inactive}
          color="gray"
          pressed={statusFilter === "inactive"}
          onClick={() => setStatusFilter((s) => (s === "inactive" ? "all" : "inactive"))}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search student…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44"
        />
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All Classes</option>
          {classTypes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterCoach}
          onChange={(e) => setFilterCoach(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All Coaches</option>
          {coaches.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="lastDate">Sort: Last Session</option>
          <option value="name">Sort: Name A→Z</option>
          <option value="sessions">Sort: Most Sessions</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => {
              setStatusFilter("all");
              setFilterCoach("");
              setFilterClass("");
              setSearch("");
            }}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-sm text-gray-400">
          {displayed.length} / {allRows.length} students
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-auto">
        <table className="w-full text-sm" style={{ minWidth: 680 }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[11px] text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-semibold">Student</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Last Session</th>
              <th className="px-4 py-3 text-right font-semibold">Days Ago</th>
              <th className="px-4 py-3 text-right font-semibold">Sessions ({windowLabel})</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 text-left font-semibold">Class</th>
              <th className="px-4 py-3 text-left font-semibold">Coach</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                  No students found
                </td>
              </tr>
            ) : (
              displayed.map((row) => (
                <StudentTableRow key={row.name} row={row} windowDays={windowDays} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentTableRow({ row, windowDays }: { row: StudentRow; windowDays: number }) {
  return (
    <tr className="hover:bg-gray-50/70 transition-colors">
      <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
      <td className="px-4 py-3">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3 text-gray-600">{fmtDate(row.lastDate)}</td>
      <td className="px-4 py-3 text-right">
        <span
          className={`font-medium tabular-nums ${
            row.daysSinceLast > windowDays
              ? "text-red-500"
              : row.status === "at-risk"
              ? "text-amber-600"
              : "text-gray-700"
          }`}
        >
          {row.daysSinceLast}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-medium text-gray-700 tabular-nums">
        {row.windowSessions}
      </td>
      <td className="px-4 py-3 text-right text-gray-400 tabular-nums">{row.totalSessions}</td>
      <td className="px-4 py-3 text-gray-600 text-xs">{row.topClass || "—"}</td>
      <td className="px-4 py-3 text-gray-600 text-xs">{row.topCoach || "—"}</td>
    </tr>
  );
}

function StatusBadge({ status }: { status: StudentRow["status"] }) {
  const styles: Record<StudentRow["status"], string> = {
    new: "bg-blue-100 text-blue-700",
    active: "bg-emerald-100 text-emerald-700",
    "at-risk": "bg-amber-100 text-amber-700",
    inactive: "bg-gray-100 text-gray-500",
  };
  const labels: Record<StudentRow["status"], string> = {
    new: "New",
    active: "Active",
    "at-risk": "At Risk",
    inactive: "Inactive",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

const CARD_PALETTE: Record<
  string,
  { base: string; pressed: string; num: string; numP: string; sub: string; subP: string }
> = {
  emerald: {
    base: "bg-white border-emerald-200 hover:bg-emerald-50",
    pressed: "bg-emerald-600 border-emerald-600",
    num: "text-emerald-600",
    numP: "text-white",
    sub: "text-gray-400",
    subP: "text-emerald-100",
  },
  blue: {
    base: "bg-white border-blue-200 hover:bg-blue-50",
    pressed: "bg-blue-600 border-blue-600",
    num: "text-blue-600",
    numP: "text-white",
    sub: "text-gray-400",
    subP: "text-blue-100",
  },
  amber: {
    base: "bg-white border-amber-200 hover:bg-amber-50",
    pressed: "bg-amber-500 border-amber-500",
    num: "text-amber-600",
    numP: "text-white",
    sub: "text-gray-400",
    subP: "text-amber-100",
  },
  gray: {
    base: "bg-white border-gray-200 hover:bg-gray-50",
    pressed: "bg-gray-600 border-gray-600",
    num: "text-gray-600",
    numP: "text-white",
    sub: "text-gray-400",
    subP: "text-gray-200",
  },
};

function SummaryCard({
  label,
  sublabel,
  value,
  color,
  pressed,
  onClick,
}: {
  label: string;
  sublabel: string;
  value: number;
  color: string;
  pressed: boolean;
  onClick: () => void;
}) {
  const p = CARD_PALETTE[color];
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left shadow-sm transition-all cursor-pointer w-full ${
        pressed ? p.pressed : p.base
      }`}
    >
      <div className={`text-3xl font-bold tabular-nums ${pressed ? p.numP : p.num}`}>{value}</div>
      <div className={`text-sm font-semibold mt-0.5 ${pressed ? p.numP : "text-gray-700"}`}>
        {label}
      </div>
      <div className={`text-xs mt-0.5 ${pressed ? p.subP : p.sub}`}>{sublabel}</div>
    </button>
  );
}
