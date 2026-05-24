import { NextResponse } from "next/server";
import { getAdminRows, getNamedSheetRows } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  const [adminRows, rateCard, coachRateCard] = await Promise.all([
    getAdminRows(),
    getNamedSheetRows("Rate Card").catch(() => [] as string[][]),
    getNamedSheetRows("Coach Rate Card").catch(() => [] as string[][]),
  ]);

  const classTypes = [...new Set(adminRows.map((r) => r.values[5]).filter(Boolean))].sort();
  const clients = [...new Set(adminRows.map((r) => r.values[43]).filter(Boolean))].sort();
  const coaches = [...new Set(adminRows.map((r) => r.values[45]).filter(Boolean))].sort();
  const courts = [...new Set(adminRows.map((r) => r.values[4]).filter(Boolean))].sort();

  return NextResponse.json({
    rows: adminRows,
    dropdowns: { classTypes, clients, coaches, courts },
    rateCard,
    coachRateCard,
  });
}
