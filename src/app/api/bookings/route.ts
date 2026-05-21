import { NextResponse } from "next/server";
import { getBookingRows } from "@/lib/sheets";
import { parseRecords } from "@/lib/parse";
import type { BookingRecord } from "@/lib/parse";

let cache: { data: BookingRecord[]; ts: number } | null = null;
const TTL = 5 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }
  const rows = await getBookingRows();
  const data = parseRecords(rows);
  cache = { data, ts: Date.now() };
  return NextResponse.json(data);
}
