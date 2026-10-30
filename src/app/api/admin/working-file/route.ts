import { NextResponse } from "next/server";
import { getNamedSheetRows, saveWorkingFileData } from "@/lib/sheets";
import { parseWorkingFile } from "@/lib/parse";
import type { CoachHoliday, DayRemark } from "@/lib/parse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getNamedSheetRows("working file");
    return NextResponse.json(parseWorkingFile(rows));
  } catch {
    return NextResponse.json({ holidays: [], remarks: [] });
  }
}

export async function POST(req: Request) {
  const { holidays, remarks } = (await req.json()) as { holidays: CoachHoliday[]; remarks: DayRemark[] };
  const holidayRows = holidays.map((h) => [h.dateDMY, h.coach, h.startTime, h.endTime, h.note]);
  const remarkRows = remarks.map((r) => [r.dateDMY, r.remark, r.startTime ?? "", r.endTime ?? ""]);
  await saveWorkingFileData(holidayRows, remarkRows);
  return NextResponse.json({ ok: true });
}
