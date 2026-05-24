import { NextRequest, NextResponse } from "next/server";
import { appendBookingRow, updateBookingColumns, deleteBookingRow } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  const { values } = await req.json();
  const rowIndex = await appendBookingRow(values);
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
