"use client";
import { useState, useMemo } from "react";
import type { CoachHoliday, DayRemark } from "@/lib/parse";
import { toISO } from "@/lib/parse";

const TIME_SLOTS = Array.from({ length: 18 }, (_, i) =>
  `${String(6 + i).padStart(2, "0")}:00`
);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isoToDMY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// Group holidays by same date+startTime+endTime+note so multiple coaches show on one row
interface HolidayGroup {
  date: string;
  startTime: string;
  endTime: string;
  note: string;
  coaches: string[];
  indices: number[];
}

function groupHolidays(holidays: CoachHoliday[]): HolidayGroup[] {
  const map = new Map<string, HolidayGroup>();
  holidays.forEach((h, i) => {
    const key = `${h.date}|${h.startTime}|${h.endTime}|${h.note}`;
    if (!map.has(key)) {
      map.set(key, { date: h.date, startTime: h.startTime, endTime: h.endTime, note: h.note, coaches: [], indices: [] });
    }
    const g = map.get(key)!;
    g.coaches.push(h.coach);
    g.indices.push(i);
  });
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

interface HolidayFormState {
  selectedCoaches: string[];
  scheduleType: "dates" | "recurring";
  dateFrom: string;
  dateTo: string;
  recurFrom: string;
  recurTo: string;
  recurDays: number[]; // 0=Mon … 6=Sun
  allDay: boolean;
  startTime: string;
  endTime: string;
  note: string;
}

const emptyForm: HolidayFormState = {
  selectedCoaches: [],
  scheduleType: "dates",
  dateFrom: "", dateTo: "",
  recurFrom: "", recurTo: "",
  recurDays: [],
  allDay: true, startTime: "", endTime: "",
  note: "",
};

function generateDates(form: HolidayFormState): string[] {
  const dates: string[] = [];
  if (form.scheduleType === "dates") {
    if (!form.dateFrom) return [];
    const from = new Date(form.dateFrom + "T00:00:00");
    const to = form.dateTo ? new Date(form.dateTo + "T00:00:00") : new Date(from);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      dates.push(toISO(new Date(d)));
    }
  } else {
    if (!form.recurFrom || !form.recurTo || form.recurDays.length === 0) return [];
    const from = new Date(form.recurFrom + "T00:00:00");
    const to = new Date(form.recurTo + "T00:00:00");
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      // JS getDay(): 0=Sun…6=Sat → convert to 0=Mon…6=Sun
      const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
      if (form.recurDays.includes(idx)) dates.push(toISO(new Date(d)));
    }
  }
  return dates;
}

function generateEntries(form: HolidayFormState): CoachHoliday[] {
  const dates = generateDates(form);
  const entries: CoachHoliday[] = [];
  for (const coach of form.selectedCoaches) {
    for (const dateISO of dates) {
      entries.push({
        date: dateISO,
        dateDMY: isoToDMY(dateISO),
        coach,
        startTime: form.allDay ? "All Day" : form.startTime,
        endTime: form.allDay ? "" : form.endTime,
        note: form.note,
      });
    }
  }
  return entries;
}

export default function HolidayRemarkEditor({
  holidays,
  remarks,
  coaches,
  onSave,
  saving,
}: {
  holidays: CoachHoliday[];
  remarks: DayRemark[];
  coaches: string[];
  onSave: (holidays: CoachHoliday[], remarks: DayRemark[]) => Promise<void>;
  saving: boolean;
}) {
  const [localHolidays, setLocalHolidays] = useState<CoachHoliday[]>(holidays);
  const [localRemarks, setLocalRemarks] = useState<DayRemark[]>(remarks);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<HolidayFormState>(emptyForm);
  const [editingIndices, setEditingIndices] = useState<number[] | null>(null);
  const [remarkForm, setRemarkForm] = useState<{ date: string; remark: string; allDay: boolean; startTime: string; endTime: string } | null>(null);
  const [showPastHolidays, setShowPastHolidays] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [editRemarkIdx, setEditRemarkIdx] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState("");

  const markDirty = () => setDirty(true);

  function setF<K extends keyof HolidayFormState>(key: K, val: HolidayFormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function toggleCoach(c: string) {
    setF("selectedCoaches",
      form.selectedCoaches.includes(c)
        ? form.selectedCoaches.filter((x) => x !== c)
        : [...form.selectedCoaches, c]
    );
  }

  function toggleDay(i: number) {
    setF("recurDays",
      form.recurDays.includes(i)
        ? form.recurDays.filter((d) => d !== i)
        : [...form.recurDays, i]
    );
  }

  const previewDates = useMemo(() => generateDates(form), [form]);
  const previewCount = previewDates.length * form.selectedCoaches.length;

  function validate(): string | null {
    if (form.selectedCoaches.length === 0) return "Select at least one coach";
    if (form.scheduleType === "dates") {
      if (!form.dateFrom) return "Select a start date";
      if (form.dateTo && form.dateTo < form.dateFrom) return "End date must be after start date";
    } else {
      if (!form.recurFrom || !form.recurTo) return "Select a start and end date for the recurring period";
      if (form.recurTo < form.recurFrom) return "End date must be after start date";
      if (form.recurDays.length === 0) return "Select at least one day of the week";
    }
    if (!form.allDay) {
      if (!form.startTime || !form.endTime) return "Select both start and end time";
      if (form.startTime >= form.endTime) return "End time must be after start time";
    }
    return null;
  }

  function openEditGroup(g: HolidayGroup) {
    const allDay = g.startTime === "All Day";
    setForm({
      selectedCoaches: [...g.coaches],
      scheduleType: "dates",
      dateFrom: g.date,
      dateTo: "",
      recurFrom: "", recurTo: "",
      recurDays: [],
      allDay,
      startTime: allDay ? "" : g.startTime,
      endTime: allDay ? "" : g.endTime,
      note: g.note,
    });
    setEditingIndices(g.indices);
    setShowForm(true);
    setErr("");
  }

  function handleAdd() {
    const e = validate();
    if (e) { setErr(e); return; }
    setErr("");
    const entries = generateEntries(form);
    setLocalHolidays((prev) => {
      // Remove old entries if editing
      const base = editingIndices
        ? prev.filter((_, i) => !editingIndices.includes(i))
        : prev;
      return [...base, ...entries].sort((a, b) => a.date.localeCompare(b.date) || a.coach.localeCompare(b.coach));
    });
    markDirty();
    setShowForm(false);
    setForm(emptyForm);
    setEditingIndices(null);
  }

  function deleteGroup(indices: number[]) {
    const s = new Set(indices);
    setLocalHolidays((prev) => prev.filter((_, i) => !s.has(i)));
    markDirty();
  }

  function deleteOne(idx: number) {
    setLocalHolidays((prev) => prev.filter((_, i) => i !== idx));
    markDirty();
  }

  // Remarks
  function openAddRemark() { setRemarkForm({ date: "", remark: "", allDay: true, startTime: "", endTime: "" }); setEditRemarkIdx(null); }
  function openEditRemark(i: number) {
    const r = localRemarks[i];
    setRemarkForm({ date: r.date, remark: r.remark, allDay: !r.startTime, startTime: r.startTime ?? "", endTime: r.endTime ?? "" });
    setEditRemarkIdx(i);
  }
  function cancelRemark() { setRemarkForm(null); setEditRemarkIdx(null); setErr(""); }
  function saveRemark() {
    if (!remarkForm) return;
    if (!remarkForm.date) { setErr("Date is required"); return; }
    if (!remarkForm.remark.trim()) { setErr("Remark cannot be empty"); return; }
    setErr("");
    if (!remarkForm.allDay && remarkForm.startTime && remarkForm.endTime && remarkForm.startTime >= remarkForm.endTime) {
      setErr("End time must be after start time"); return;
    }
    const entry: DayRemark = {
      date: remarkForm.date,
      dateDMY: isoToDMY(remarkForm.date),
      remark: remarkForm.remark.trim(),
      startTime: remarkForm.allDay ? undefined : remarkForm.startTime || undefined,
      endTime: remarkForm.allDay ? undefined : remarkForm.endTime || undefined,
    };
    setLocalRemarks((prev) => {
      const next = [...prev];
      if (editRemarkIdx !== null) { next[editRemarkIdx] = entry; }
      else {
        const ei = next.findIndex((r) => r.date === entry.date);
        if (ei !== -1) next[ei] = entry; else next.push(entry);
      }
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });
    markDirty();
    setRemarkForm(null);
    setEditRemarkIdx(null);
  }
  function deleteRemark(i: number) {
    setLocalRemarks((prev) => prev.filter((_, j) => j !== i));
    markDirty();
    if (editRemarkIdx === i) { setRemarkForm(null); setEditRemarkIdx(null); }
  }

  async function handleSave() {
    await onSave(localHolidays, localRemarks);
    setDirty(false);
  }

  const groups = useMemo(() => groupHolidays(localHolidays), [localHolidays]);
  const today = new Date().toISOString().slice(0, 10);
  const upcomingGroups = useMemo(() => groups.filter((g) => g.date >= today), [groups, today]);
  const visibleGroups = useMemo(() => {
    if (showPastHolidays) return groups;
    return upcomingGroups.slice(0, visibleCount);
  }, [groups, upcomingGroups, showPastHolidays, visibleCount]);
  const field = "w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const segBtn = (active: boolean) =>
    `px-4 py-1.5 text-xs font-medium transition-colors ${active ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`;

  return (
    <div className="space-y-8">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Holidays &amp; Day Remarks</h2>
        {dirty && (
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save to Google Sheet"}
          </button>
        )}
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{err}</div>
      )}

      {/* ══ COACH HOLIDAYS ══════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Coach Holidays / Unavailability</h3>
            <p className="text-xs text-gray-400 mt-0.5">Select multiple coaches and add one-off or recurring unavailability at once</p>
          </div>
          {!showForm && (
            <button onClick={() => { setShowForm(true); setEditingIndices(null); setForm(emptyForm); setErr(""); }}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
              + Add Holiday
            </button>
          )}
        </div>

        {/* ── Form ── */}
        {showForm && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-6">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-gray-700">
                {editingIndices ? "Edit Holiday" : "New Holiday"}
              </h4>
              {editingIndices && (
                <span className="text-xs bg-amber-100 text-amber-700 rounded px-2 py-0.5 font-medium">Editing</span>
              )}
            </div>

            {/* Step 1 — Coaches */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">1 · Select Coaches</span>
                <div className="flex gap-3">
                  <button onClick={() => setF("selectedCoaches", [...coaches])}
                    className="text-xs text-emerald-600 hover:underline font-medium">Select all</button>
                  <button onClick={() => setF("selectedCoaches", [])}
                    className="text-xs text-gray-400 hover:underline">Clear</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {coaches.map((c) => {
                  const on = form.selectedCoaches.includes(c);
                  return (
                    <button key={c} onClick={() => toggleCoach(c)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        on ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                           : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-600"
                      }`}>
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        on ? "border-white bg-white" : "border-gray-400"
                      }`}>
                        {on && <span className="block w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                      </span>
                      {c}
                    </button>
                  );
                })}
              </div>
              {form.selectedCoaches.length > 0 && (
                <p className="text-xs text-emerald-600 mt-2 font-medium">
                  {form.selectedCoaches.length} coach{form.selectedCoaches.length > 1 ? "es" : ""} selected: {form.selectedCoaches.join(", ")}
                </p>
              )}
            </div>

            {/* Step 2 — When */}
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">2 · When</span>
              <div className="flex rounded-lg overflow-hidden border border-gray-300 w-fit mb-4">
                <button className={segBtn(form.scheduleType === "dates")}
                  onClick={() => setF("scheduleType", "dates")}>Specific Date(s)</button>
                <button className={segBtn(form.scheduleType === "recurring")}
                  onClick={() => setF("scheduleType", "recurring")}>Recurring</button>
              </div>

              {form.scheduleType === "dates" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      From <span className="text-red-500">*</span>
                    </label>
                    <input type="date" value={form.dateFrom}
                      onChange={(e) => setF("dateFrom", e.target.value)} className={field} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      To <span className="text-gray-400 font-normal">(optional — leave blank for single day)</span>
                    </label>
                    <input type="date" value={form.dateTo}
                      onChange={(e) => setF("dateTo", e.target.value)} className={field} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Period From <span className="text-red-500">*</span></label>
                      <input type="date" value={form.recurFrom}
                        onChange={(e) => setF("recurFrom", e.target.value)} className={field} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Period To <span className="text-red-500">*</span></label>
                      <input type="date" value={form.recurTo}
                        onChange={(e) => setF("recurTo", e.target.value)} className={field} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Repeat on <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {WEEKDAYS.map((day, i) => {
                        const on = form.recurDays.includes(i);
                        return (
                          <button key={day} onClick={() => toggleDay(i)}
                            className={`w-11 h-11 rounded-full text-xs font-semibold border transition-all ${
                              on ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                 : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"
                            }`}>
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3 — Time */}
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">3 · Time</span>
              <div className="flex rounded-lg overflow-hidden border border-gray-300 w-fit mb-3">
                <button className={segBtn(form.allDay)} onClick={() => setF("allDay", true)}>All Day</button>
                <button className={segBtn(!form.allDay)} onClick={() => setF("allDay", false)}>Specific Hours</button>
              </div>
              {!form.allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">From <span className="text-red-500">*</span></label>
                    <select value={form.startTime} onChange={(e) => setF("startTime", e.target.value)} className={field}>
                      <option value="">—</option>
                      {TIME_SLOTS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">To <span className="text-red-500">*</span></label>
                    <select value={form.endTime} onChange={(e) => setF("endTime", e.target.value)} className={field}>
                      <option value="">—</option>
                      {TIME_SLOTS.filter((t) => !form.startTime || t > form.startTime).map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Step 4 — Note */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                4 · Note <span className="font-normal text-gray-400 normal-case">(optional)</span>
              </label>
              <input type="text" value={form.note} onChange={(e) => setF("note", e.target.value)}
                placeholder="e.g. Sick leave, National holiday, Training camp…" className={field} />
            </div>

            {/* Preview */}
            {previewCount > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {previewCount}
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    {previewCount} entr{previewCount === 1 ? "y" : "ies"} will be added
                  </p>
                  <p className="text-xs text-emerald-600">
                    {form.selectedCoaches.length} coach{form.selectedCoaches.length > 1 ? "es" : ""} × {previewDates.length} day{previewDates.length > 1 ? "s" : ""}
                    {!form.allDay && form.startTime && form.endTime && ` · ${form.startTime}–${form.endTime}`}
                    {form.allDay && " · All Day"}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-200">
              <button onClick={() => { setShowForm(false); setForm(emptyForm); setEditingIndices(null); setErr(""); }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleAdd}
                className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                {editingIndices
                  ? "Save Changes"
                  : previewCount > 0
                    ? `Add ${previewCount} Entr${previewCount === 1 ? "y" : "ies"}`
                    : "Add Holiday"}
              </button>
            </div>
          </div>
        )}

        {/* Holiday list */}
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4 text-center">No holidays recorded yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {showPastHolidays
                  ? `${groups.length} total`
                  : `Showing ${visibleGroups.length} of ${upcomingGroups.length} upcoming`}
              </span>
              <button
                onClick={() => setShowPastHolidays((v) => !v)}
                className="text-xs text-emerald-600 hover:underline font-medium"
              >
                {showPastHolidays ? "Hide past" : `Show past (${groups.filter((g) => g.date < today).length})`}
              </button>
            </div>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 font-medium">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Coaches</th>
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">Note</th>
                  <th className="px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleGroups.map((g, gi) => (
                  <tr key={gi} className={`hover:bg-gray-50 ${g.date < today ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap align-top">{formatDate(g.date)}</td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        {g.coaches.map((c, ci) => (
                          <span key={ci} className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 text-xs px-2 py-0.5">
                            {c}
                            <button onClick={() => deleteOne(g.indices[ci])}
                              className="text-gray-400 hover:text-red-500 leading-none ml-0.5 font-bold">×</button>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        g.startTime === "All Day"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {g.startTime === "All Day" ? "All Day" : `${g.startTime}–${g.endTime}`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs align-top">{g.note || "—"}</td>
                    <td className="px-3 py-2.5 text-right align-top whitespace-nowrap">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openEditGroup(g)}
                          className="text-xs text-emerald-600 hover:underline">
                          Edit
                        </button>
                        <button onClick={() => deleteGroup(g.indices)}
                          className="text-xs text-red-400 hover:text-red-600 hover:underline">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showPastHolidays && visibleCount < upcomingGroups.length && (
            <button
              onClick={() => setVisibleCount((n) => n + 20)}
              className="w-full py-2 text-xs font-medium text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition-colors"
            >
              Show 20 more ({upcomingGroups.length - visibleCount} remaining)
            </button>
          )}
          </div>
        )}
      </section>

      {/* ══ DAY REMARKS ═════════════════════════════════════ */}
      <section className="space-y-4 pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Day Remarks</h3>
            <p className="text-xs text-gray-400 mt-0.5">A note shown in the calendar header for a specific day</p>
          </div>
          <button onClick={openAddRemark}
            className="px-3 py-1.5 bg-white border border-emerald-600 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-50">
            + Add Remark
          </button>
        </div>

        {remarkForm && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date" value={remarkForm.date}
                  onChange={(e) => setRemarkForm((f) => f && { ...f, date: e.target.value })} className={field} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Remark <span className="text-red-500">*</span></label>
                <input type="text" value={remarkForm.remark}
                  onChange={(e) => setRemarkForm((f) => f && { ...f, remark: e.target.value })}
                  placeholder="e.g. School holiday, Special event…" className={field} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Time</label>
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg overflow-hidden border border-gray-300 w-fit">
                  <button className={segBtn(remarkForm.allDay)} onClick={() => setRemarkForm((f) => f && { ...f, allDay: true, startTime: "" })}>All Day</button>
                  <button className={segBtn(!remarkForm.allDay)} onClick={() => setRemarkForm((f) => f && { ...f, allDay: false })}>Time Slot</button>
                </div>
                {!remarkForm.allDay && (
                  <div className="flex items-center gap-2">
                    <select value={remarkForm.startTime}
                      onChange={(e) => setRemarkForm((f) => f && { ...f, startTime: e.target.value })}
                      className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="">— From —</option>
                      {TIME_SLOTS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    <span className="text-gray-400 text-sm">–</span>
                    <select value={remarkForm.endTime}
                      onChange={(e) => setRemarkForm((f) => f && { ...f, endTime: e.target.value })}
                      className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="">— To —</option>
                      {TIME_SLOTS.filter((t) => !remarkForm.startTime || t > remarkForm.startTime).map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              {editRemarkIdx !== null && (
                <button onClick={() => deleteRemark(editRemarkIdx)}
                  className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Delete</button>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={cancelRemark} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={saveRemark} className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                  {editRemarkIdx !== null ? "Update" : "Add"}
                </button>
              </div>
            </div>
          </div>
        )}

        {localRemarks.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4 text-center">No day remarks recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 font-medium">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">Remark</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {localRemarks.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${r.startTime ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                        {r.startTime ? `${r.startTime}${r.endTime ? `–${r.endTime}` : ""}` : "All Day"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-block rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs px-2 py-0.5 font-medium">
                        {r.remark}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => openEditRemark(i)} className="text-xs text-emerald-600 hover:underline">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
