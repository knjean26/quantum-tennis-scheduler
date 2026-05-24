import { NextRequest, NextResponse } from "next/server";
import { getNamedSheetRows, updateNamedSheetRows } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getNamedSheetRows("Rate Card");
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const { rows } = await req.json();
  await updateNamedSheetRows("Rate Card", rows);
  return NextResponse.json({ success: true });
}
