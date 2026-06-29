import { NextRequest, NextResponse } from "next/server";
import { appendBookingByFieldMap, updateBookingColumns, deleteBookingRow } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  const { fieldMap } = await req.json();
  const rowIndex = await appendBookingByFieldMap(fieldMap);
  return NextResponse.json({ rowIndex });
}

export async function PUT(req: NextRequest) {
  const { rowIndex, fieldMap } = await req.json();
  await updateBookingColumns(rowIndex, fieldMap);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { rowIndex } = await req.json();
  await deleteBookingRow(rowIndex);
  return NextResponse.json({ success: true });
}
