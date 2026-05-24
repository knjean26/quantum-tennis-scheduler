"use client";
import { useState } from "react";
import type { AdminBooking } from "@/lib/parse";

const MAX_COPIES = 4;

export default function CopyBookingModal({
  booking,
  onCopy,
  onClose,
  saving,
}: {
  booking: AdminBooking;
  onCopy: (dates: string[]) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}) {
  const [dates, setDates] = useState<string[]>([""]);

  function updateDate(i: number, val: string) {
    setDates((prev) => prev.map((d, idx) => (idx === i ? val : d)));
  }

  function addDate() {
    if (dates.length < MAX_COPIES) setDates((prev) => [...prev, ""]);
  }

  function removeDate(i: number) {
    setDates((prev) => prev.filter((_, idx) => idx !== i));
  }

  const validDates = dates.filter((d) => d.trim());

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Copy Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Source summary */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 text-sm space-y-0.5">
          <div className="font-medium text-gray-800">{booking.client || "—"}</div>
          <div className="text-gray-500">
            {[booking.classType, booking.classValue].filter(Boolean).join(" · ")}
            {booking.court ? ` · Court ${booking.court}` : ""}
          </div>
          <div className="text-gray-500">
            {booking.startTime}–{booking.endTime}
            {booking.students ? ` · ${booking.students} student${booking.students !== 1 ? "s" : ""}` : ""}
            {booking.coach ? ` · ${booking.coach}` : ""}
          </div>
        </div>

        {/* Date pickers */}
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-600">
            Choose up to {MAX_COPIES} new dates:
          </p>
          {dates.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="date"
                value={d}
                onChange={(e) => updateDate(i, e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {dates.length > 1 && (
                <button
                  onClick={() => removeDate(i)}
                  className="text-gray-400 hover:text-red-500 px-1 text-lg leading-none"
                  title="Remove"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {dates.length < MAX_COPIES && (
            <button
              onClick={addDate}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              + Add another date
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void onCopy(validDates)}
            disabled={validDates.length === 0 || saving}
            className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving
              ? "Copying…"
              : `Copy ${validDates.length > 0 ? validDates.length + " " : ""}Booking${validDates.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
