// Columns: A=0 date, B=1 day, C=2 start, D=3 end, E=4 court, F=5 classType, G=6 class, H=7 price
// I=8 students, J=9 totalPrice, AR=43 client, AT=45 coach, AU=46 coachFee, AV=47 coachFeeGroup
// AW=48 aceFee, AX=49 quantumFee, AY=50 courtFee, BA=52 grandTotal

export interface BookingRecord {
  date: string;
  dayName: string;
  startTime: string;
  endTime: string;
  duration: number;
  court: string;
  classType: string;
  students: number;
  client: string;
  coach: string;
  weekStart: string;
  weekLabel: string;
  remark: string;  // BH = col 59
}

export interface AdminBooking extends BookingRecord {
  rowIndex: number;
  raw: string[];
  classValue: string;
  price: string;
  totalPrice: string;
  coachFee: string;
  coachFeeGroup: string;
  aceFee: string;
  quantumFee: string;
  courtFee: string;
  grandTotal: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseDateDMY(str: string): Date | null {
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekStart(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
}

function weekLabel(mon: Date): string {
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const year = sun.getFullYear();
  if (mon.getMonth() === sun.getMonth()) {
    return `${mon.getDate()}–${sun.getDate()} ${MONTHS[mon.getMonth()]} ${year}`;
  }
  return `${fmt(mon)} – ${fmt(sun)} ${year}`;
}

export function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - sh * 60 - sm;
  return mins > 0 ? mins / 60 : 0;
}

export function isValidCourt(court: string): boolean {
  const n = parseInt(court);
  return !isNaN(n) && n >= 0 && n <= 9 && String(n) === court.trim();
}

export function parseRecords(rows: string[][]): BookingRecord[] {
  const records: BookingRecord[] = [];
  for (const row of rows) {
    const dateStr = row[0]?.trim();
    const startTime = row[2]?.trim();
    const endTime = row[3]?.trim();
    if (!dateStr || !startTime || !endTime) continue;

    const date = parseDateDMY(dateStr);
    if (!date) continue;

    const weekMon = getWeekStart(date);

    records.push({
      date: toISO(date),
      dayName: DAYS[date.getDay()],
      startTime,
      endTime,
      duration: calcDuration(startTime, endTime),
      court: (row[4] ?? "").trim(),
      classType: (row[6] ?? "").trim().replace(/\t/g, ""),
      students: parseInt(row[8] ?? "0") || 0,
      client: (row[43] ?? "").trim(),
      coach: (row[45] ?? "").trim(),
      weekStart: toISO(weekMon),
      weekLabel: weekLabel(weekMon),
      remark: (row[59] ?? "").trim(),
    });
  }
  return records;
}

export function parseAdminBookings(
  adminRows: { rowIndex: number; values: string[] }[]
): AdminBooking[] {
  const result: AdminBooking[] = [];
  for (const { rowIndex, values: row } of adminRows) {
    const dateStr = row[0]?.trim();
    const startTime = row[2]?.trim();
    const endTime = row[3]?.trim();
    if (!dateStr || !startTime || !endTime) continue;

    const date = parseDateDMY(dateStr);
    if (!date) continue;

    const weekMon = getWeekStart(date);

    result.push({
      rowIndex,
      raw: row,
      date: toISO(date),
      dayName: DAYS[date.getDay()],
      startTime,
      endTime,
      duration: calcDuration(startTime, endTime),
      court: (row[4] ?? "").trim(),
      classType: (row[5] ?? "").trim(),
      classValue: (row[6] ?? "").trim(),
      price: (row[7] ?? "").trim(),
      students: parseInt(row[8] ?? "0") || 0,
      totalPrice: (row[9] ?? "").trim(),
      client: (row[43] ?? "").trim(),
      coach: (row[45] ?? "").trim(),
      coachFee: (row[46] ?? "").trim(),
      coachFeeGroup: (row[47] ?? "").trim(),
      aceFee: (row[48] ?? "").trim(),
      quantumFee: (row[49] ?? "").trim(),
      courtFee: (row[50] ?? "").trim(),
      grandTotal: (row[52] ?? "").trim(),
      weekStart: toISO(weekMon),
      weekLabel: weekLabel(weekMon),
      remark: (row[59] ?? "").trim(),
    });
  }
  return result;
}

export function groupByWeek<T extends BookingRecord>(
  records: T[]
): { weekStart: string; weekLabel: string; records: T[] }[] {
  const map = new Map<string, { weekStart: string; weekLabel: string; records: T[] }>();
  for (const r of records) {
    if (!map.has(r.weekStart)) {
      map.set(r.weekStart, { weekStart: r.weekStart, weekLabel: r.weekLabel, records: [] });
    }
    map.get(r.weekStart)!.records.push(r);
  }
  return Array.from(map.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function totalCourtHours(records: BookingRecord[]): number {
  return records
    .filter((r) => isValidCourt(r.court))
    .reduce((sum, r) => sum + r.duration, 0);
}

export function coachColorIndex(coach: string, palette: unknown[]): number {
  if (!coach) return 0;
  let hash = 0;
  for (let i = 0; i < coach.length; i++) hash = (hash * 31 + coach.charCodeAt(i)) & 0xffff;
  return hash % palette.length;
}
