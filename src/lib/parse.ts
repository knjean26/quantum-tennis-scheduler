// Columns: A=0 date, C=2 start, D=3 end, E=4 court, F=5 classType, I=8 students, AR=43 client, AT=45 coach

export interface BookingRecord {
  date: string;       // "YYYY-MM-DD"
  dayName: string;
  startTime: string;  // "08:00"
  endTime: string;    // "09:00"
  duration: number;   // hours (can be fractional)
  court: string;      // "1"–"5", might be "0" for no-court
  classType: string;  // e.g. "Private", "Group"
  students: number;
  client: string;
  coach: string;
  weekStart: string;  // "YYYY-MM-DD" Monday of the week
  weekLabel: string;  // human-readable, e.g. "18–24 May 2026"
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDateDMY(str: string): Date | null {
  // "DD/MM/YYYY"
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getWeekStart(d: Date): Date {
  const day = d.getDay(); // 0=Sun
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

function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - sh * 60 - sm;
  return mins > 0 ? mins / 60 : 0;
}

export function isValidCourt(court: string): boolean {
  const n = parseInt(court);
  return !isNaN(n) && n >= 1 && n <= 9 && String(n) === court.trim();
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
    });
  }
  return records;
}

export function groupByWeek(
  records: BookingRecord[]
): { weekStart: string; weekLabel: string; records: BookingRecord[] }[] {
  const map = new Map<string, { weekStart: string; weekLabel: string; records: BookingRecord[] }>();
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
