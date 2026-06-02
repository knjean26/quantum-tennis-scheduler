"use client";
import { useState, useEffect, useMemo } from "react";
import Combobox from "./Combobox";
import { calcDuration } from "@/lib/parse";
import type { AdminBooking } from "@/lib/parse";

export interface BookingFormData {
  date: string;
  court: string;
  startTime: string;
  endTime: string;
  classType: string;
  classValue: string;
  students: string;
  price: string;
  totalPrice: string;
  client: string;
  coachName: string;
  coachFee: string;
  coachFeeGroup: string;
  aceFee: string;
  quantumFee: string;
  courtFee: string;
  grandTotal: string;
  remark: string;
  confirmed: boolean;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COURTS = ["0", "1", "2", "3", "4", "5"];
const TIME_SLOTS = Array.from({ length: 18 }, (_, i) =>
  `${String(6 + i).padStart(2, "0")}:00`
);

const DROPDOWN_REMARKS = ["Cancel", "Payment Requested", "DONE"];

const PRIVATE_CLASSES = ["Senior Head Coach", "Senior Coach", "Coach", "Coach-TPSP", "Hitting Partner"];
const FOREIGNER_CLASSES = ["Senior Head Coach (eng)", "Senior Coach (eng/jpn)", "Hitting Partner (eng/jpn)"];
const GROUP_CLASSES = ["Red Ball (Tennis 10s)", "Junior Class", "Adult Class"];
const STA_CLASSES = ["Parent Class", "ECA"];

function getClassOptions(classType: string): string[] {
  const ct = classType.toLowerCase().trim();
  if (ct === "private") return PRIVATE_CLASSES;
  if (ct.includes("foreign")) return FOREIGNER_CLASSES;
  if (ct === "group") return GROUP_CLASSES;
  if (ct === "sta") return STA_CLASSES;
  return [];
}

function numericVal(s: string): number {
  return parseFloat(s.replace(/[,฿$\s]/g, "")) || 0;
}

function normalizeCurrency(s: string): string {
  if (!s) return "";
  const n = numericVal(s);
  return n === 0 ? "" : String(n);
}

// Rate Card columns: 0=ClassType, 1=Class, 2=NumPlayers, 3=Duration, 4=Price, 5=ExtraFee
function lookupRateCard(rateCard: string[][], classType: string, classValue: string, numStudents: number): number {
  if (rateCard.length < 2) return 0;
  const ct = classType.toLowerCase().trim();
  const cv = classValue.toLowerCase().trim();
  const ns = String(numStudents);
  for (const row of rateCard.slice(1)) {
    if (
      (row[0] ?? "").toLowerCase().trim() === ct &&
      (row[1] ?? "").toLowerCase().trim() === cv &&
      (row[2] ?? "").trim() === ns
    ) {
      return numericVal(row[4] ?? "");
    }
  }
  return 0;
}

// Coach Rate Card columns: 0=Class, 1=Name, 2=NumPlayers, 3=VLOOKUP, 4=Price, 5=CoachFee, 6=AceFee, 7=QuantumSubTotal
interface CoachRateResult { coachFee: number; aceFee: number; quantumSubTotal: number }
function lookupCoachRateCard(
  coachRateCard: string[][],
  classValue: string,
  coachName: string,
  numStudents: number
): CoachRateResult | null {
  if (coachRateCard.length < 2) return null;
  const cv = classValue.toLowerCase().trim();
  const cn = coachName.toLowerCase().trim();
  const ns = String(numStudents);
  for (const row of coachRateCard.slice(1)) {
    if (
      (row[0] ?? "").toLowerCase().trim() === cv &&
      (row[1] ?? "").toLowerCase().trim() === cn &&
      (row[2] ?? "").trim() === ns
    ) {
      return {
        coachFee: numericVal(row[5] ?? ""),
        aceFee: numericVal(row[6] ?? ""),
        quantumSubTotal: numericVal(row[7] ?? ""),
      };
    }
  }
  return null;
}

function initForm(booking?: AdminBooking, prefill?: { date?: string; startTime?: string }): BookingFormData {
  if (booking) {
    // If court stored as "34" (two-hour split), keep only first digit in the form field
    const court = (booking.court?.length ?? 0) >= 2 ? booking.court[0] : booking.court;
    return {
      date: booking.date,
      court,
      startTime: booking.startTime,
      endTime: booking.endTime,
      classType: booking.classType,
      classValue: booking.classValue,
      students: String(booking.students || 1),
      price: normalizeCurrency(booking.price),
      totalPrice: normalizeCurrency(booking.totalPrice),
      client: booking.client,
      coachName: booking.coach,
      coachFee: normalizeCurrency(booking.coachFee),
      coachFeeGroup: normalizeCurrency(booking.coachFeeGroup),
      aceFee: normalizeCurrency(booking.aceFee),
      quantumFee: normalizeCurrency(booking.quantumFee),
      courtFee: normalizeCurrency(booking.courtFee),
      grandTotal: normalizeCurrency(booking.grandTotal),
      remark: booking.remark ?? "",
      confirmed: booking.confirmed ?? false,
    };
  }
  return {
    date: prefill?.date ?? "",
    court: "",
    startTime: prefill?.startTime ?? "",
    endTime: "",
    classType: "Private",
    classValue: "",
    students: "1",
    price: "",
    totalPrice: "",
    client: "",
    coachName: "",
    coachFee: "",
    coachFeeGroup: "",
    aceFee: "",
    quantumFee: "",
    courtFee: "",
    grandTotal: "",
    remark: "",
    confirmed: false,
  };
}

export default function BookingFormModal({
  mode,
  booking,
  prefill,
  dropdowns,
  rateCard,
  coachRateCard,
  onSave,
  onDelete,
  onCopy,
  onClose,
  saving,
}: {
  mode: "add" | "edit";
  booking?: AdminBooking;
  prefill?: { date?: string; startTime?: string };
  dropdowns: { classTypes: string[]; clients: string[]; coaches: string[]; courts: string[] };
  rateCard: string[][];
  coachRateCard: string[][];
  onSave: (data: BookingFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCopy?: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<BookingFormData>(() => initForm(booking, prefill));
  const [errors, setErrors] = useState<string[]>([]);

  // Split-court state: only relevant for 2-hour bookings
  const [splitCourt, setSplitCourt] = useState(() => (booking?.court?.length ?? 0) >= 2);
  const [courtSecond, setCourtSecond] = useState<string>(() =>
    (booking?.court?.length ?? 0) >= 2 ? booking!.court[1] : ""
  );

  function set(key: keyof BookingFormData, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  const duration = useMemo(
    () => calcDuration(form.startTime, form.endTime),
    [form.startTime, form.endTime]
  );

  const dayShort = useMemo(() => {
    if (!form.date) return "";
    return DAY_SHORT[new Date(form.date + "T00:00:00").getDay()];
  }, [form.date]);

  // Unique classes from Coach Rate Card col 0
  const classOptionsFromRC = useMemo(() => {
    if (coachRateCard.length < 2) return [];
    return [...new Set(
      coachRateCard.slice(1).map((r) => (r[0] ?? "").trim()).filter(Boolean)
    )].sort();
  }, [coachRateCard]);

  // Class options: hardcoded per class type, or all from Coach Rate Card as fallback
  const classOptions = useMemo(() => {
    const hardcoded = getClassOptions(form.classType);
    return hardcoded.length > 0 ? hardcoded : classOptionsFromRC;
  }, [form.classType, classOptionsFromRC]);

  // All coaches from Coach Rate Card (coach-first flow)
  const allCoachOptions = useMemo(() => {
    if (coachRateCard.length < 2) return dropdowns.coaches;
    const fromRC = [...new Set(
      coachRateCard.slice(1).map((r) => (r[1] ?? "").trim()).filter(Boolean)
    )].sort();
    return fromRC.length > 0 ? fromRC : dropdowns.coaches;
  }, [coachRateCard, dropdowns.coaches]);

  // Auto-detect class from selected coach
  useEffect(() => {
    if (!form.coachName || coachRateCard.length < 2) return;
    const cn = form.coachName.toLowerCase().trim();
    const classes = [...new Set(
      coachRateCard.slice(1)
        .filter((r) => (r[1] ?? "").toLowerCase().trim() === cn)
        .map((r) => (r[0] ?? "").trim())
        .filter(Boolean)
    )];
    if (classes.length > 0) set("classValue", classes[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.coachName, coachRateCard]);

  // Reset split-court when duration changes away from 2
  useEffect(() => {
    if (duration !== 2) {
      setSplitCourt(false);
      setCourtSecond("");
    }
  }, [duration]);

  // Price from Rate Card
  useEffect(() => {
    const students = parseInt(form.students) || 1;
    const p = lookupRateCard(rateCard, form.classType, form.classValue, students);
    if (p > 0) set("price", String(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.classType, form.classValue, form.students, rateCard]);

  // TotalPrice = Price × Duration (rate card prices are per 1-hour session)
  useEffect(() => {
    const price = numericVal(form.price);
    const dur = duration > 0 ? duration : 1;
    if (price > 0) set("totalPrice", String(Math.round(price * dur)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.price, duration]);

  // CoachFee + AceFee from Coach Rate Card
  useEffect(() => {
    const students = parseInt(form.students) || 1;
    const result = lookupCoachRateCard(coachRateCard, form.classValue, form.coachName, students);
    if (result) {
      const dur = duration > 0 ? duration : 1;
      set("coachFee", String(Math.round(result.coachFee * dur)));
      set("coachFeeGroup", String(Math.round(result.coachFee * dur)));
      set("aceFee", String(Math.round(result.aceFee * dur)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.classValue, form.coachName, form.students, duration, coachRateCard]);

  // CourtFee = ฿650/hr, 0 if student booked court themselves
  useEffect(() => {
    if (form.remark === "จองสนามเอง") {
      set("courtFee", "0");
    } else {
      const dur = duration > 0 ? duration : 1;
      set("courtFee", String(Math.round(650 * dur)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, form.remark]);

  // QuantumFee = TotalPrice - CoachFee - AceFee
  useEffect(() => {
    const tp = numericVal(form.totalPrice);
    const cf = numericVal(form.coachFee);
    const af = numericVal(form.aceFee);
    if (tp > 0) set("quantumFee", String(Math.max(0, tp - cf - af)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.totalPrice, form.coachFee, form.aceFee]);

  // GrandTotal = TotalPrice + CourtFee
  const grandTotal = useMemo(() => {
    return numericVal(form.totalPrice) + numericVal(form.courtFee);
  }, [form.totalPrice, form.courtFee]);

  function validate(): boolean {
    const errs: string[] = [];
    if (!form.date) errs.push("Date is required");
    if (!form.court) errs.push("Court is required");
    if (!form.startTime) errs.push("Start time is required");
    if (!form.endTime) errs.push("End time is required");
    if (form.startTime && form.endTime && form.startTime >= form.endTime)
      errs.push("End time must be after start time");
    setErrors(errs);
    return errs.length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    // Combine courts if split (e.g. court=3, courtSecond=4 → "34")
    const court = splitCourt && courtSecond ? form.court + courtSecond : form.court;
    void onSave({ ...form, court, grandTotal: String(grandTotal) });
  }

  const allClassTypes = [...new Set(["Private", "Foreigner", "Group", "STA", ...dropdowns.classTypes])];

  const field = "w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const readField = "px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 font-medium";
  const courtSelect = "w-28 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {mode === "add" ? "Add Booking" : "Edit Booking"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 space-y-0.5">
              {errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}

          {/* Session */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Session</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={field} />
              </div>
              <div className="flex items-end pb-0.5">
                {dayShort && (
                  <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-md text-sm font-semibold border border-emerald-200">
                    {dayShort}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Time <span className="text-red-500">*</span></label>
                <select value={form.startTime} onChange={(e) => set("startTime", e.target.value)} className={field}>
                  <option value="">—</option>
                  {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End Time <span className="text-red-500">*</span></label>
                <select value={form.endTime} onChange={(e) => set("endTime", e.target.value)} className={field}>
                  <option value="">—</option>
                  {TIME_SLOTS.filter((t) => !form.startTime || t > form.startTime).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Duration</label>
                <div className={readField}>
                  {duration > 0 ? `${duration % 1 === 0 ? duration : duration.toFixed(1)} hr` : "—"}
                </div>
              </div>
            </div>

            {/* Court — supports split court for 2-hour bookings */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Court <span className="text-red-500">*</span></label>
              <div className="flex flex-wrap items-center gap-2">
                <select value={form.court} onChange={(e) => set("court", e.target.value)} className={courtSelect}>
                  <option value="">Select</option>
                  {COURTS.map((c) => <option key={c} value={c}>Court {c}</option>)}
                </select>
                {duration === 2 && (
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={splitCourt}
                      onChange={(e) => { setSplitCourt(e.target.checked); if (!e.target.checked) setCourtSecond(""); }}
                      className="w-4 h-4 rounded border-gray-300 accent-emerald-600"
                    />
                    <span className="text-xs text-gray-600">Different court for 2nd hour</span>
                  </label>
                )}
                {splitCourt && duration === 2 && (
                  <select value={courtSecond} onChange={(e) => setCourtSecond(e.target.value)} className={courtSelect}>
                    <option value="">Select 2nd</option>
                    {COURTS.map((c) => <option key={c} value={c}>Court {c}</option>)}
                  </select>
                )}
              </div>
            </div>
          </section>

          {/* Class + Coach */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Class</h3>
            {/* Coach first — drives class auto-detection */}
            <Combobox
              label="Coach Name"
              value={form.coachName}
              options={allCoachOptions}
              onChange={(v) => set("coachName", v)}
              placeholder="Search coach…"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Class Type</label>
                <select
                  value={form.classType}
                  onChange={(e) => {
                    set("classType", e.target.value);
                    set("classValue", "");
                    set("coachName", "");
                  }}
                  className={field}
                >
                  <option value="">Select type</option>
                  {allClassTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={form.classValue}
                  onChange={(e) => set("classValue", e.target.value)}
                  className={field}
                >
                  <option value="">Select class</option>
                  {form.classValue && !classOptions.includes(form.classValue) && (
                    <option value={form.classValue}>{form.classValue}</option>
                  )}
                  {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Students + Client — same row */}
          <section className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">No. of Students</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={form.students}
                  onChange={(e) => set("students", e.target.value)}
                  className={field}
                />
              </div>
              <Combobox
                label="Client"
                value={form.client}
                options={dropdowns.clients}
                onChange={(v) => set("client", v)}
                placeholder="Search or type client name…"
              />
            </div>
          </section>

          {/* Status flags */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</h3>
            <select
              value={DROPDOWN_REMARKS.includes(form.remark) ? form.remark : ""}
              onChange={(e) => set("remark", e.target.value)}
              className={`w-full border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                form.remark === "Cancel" ? "border-red-500 bg-red-100 text-red-800 font-semibold"
                : form.remark === "Payment Requested" ? "border-yellow-400 bg-yellow-50 text-yellow-800"
                : "border-gray-300"
              }`}
            >
              <option value="">—</option>
              <option value="Cancel">Cancel</option>
              <option value="Payment Requested">Payment Requested</option>
              <option value="DONE">DONE</option>
            </select>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.remark === "จองสนามเอง"}
                onChange={(e) => set("remark", e.target.checked ? "จองสนามเอง" : "")}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 accent-purple-600"
              />
              <span className="text-sm text-gray-700">จองสนามเอง — student booked court (court fee = 0)</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.remark === "ขายสนาม"}
                onChange={(e) => set("remark", e.target.checked ? "ขายสนาม" : "")}
                className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 accent-amber-600"
              />
              <span className="text-sm text-gray-700">ขายสนาม — court sale</span>
            </label>
          </section>

          {/* Grand Total */}
          <div className="bg-emerald-50 rounded-xl px-5 py-3 flex items-center justify-between border border-emerald-100">
            <div>
              <div className="text-xs text-emerald-600 font-medium">Grand Total</div>
              <div className="text-[10px] text-emerald-500 mt-0.5">auto-calculated</div>
            </div>
            <span className="text-2xl font-bold text-emerald-700">
              {grandTotal > 0 ? `฿${grandTotal.toLocaleString()}` : "—"}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <div className="flex gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            )}
            {onCopy && (
              <button
                type="button"
                onClick={onCopy}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50"
              >
                Copy
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : mode === "add" ? "Add Booking" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
