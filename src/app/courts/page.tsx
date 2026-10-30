import { getBookingRows } from "@/lib/sheets";
import { parseRecords, groupByWeek, isValidCourt, withFullYearWeeks } from "@/lib/parse";
import CourtMonitor from "@/components/CourtMonitor";

export const dynamic = "force-dynamic";

export default async function CourtsPage() {
  const rows = await getBookingRows();
  const all = parseRecords(rows);

  // Expand "34"-style courts: first hour on court 3, second hour on court 4
  const expanded = all.flatMap((r) => {
    if (r.court.length === 2 && isValidCourt(r.court[0]) && isValidCourt(r.court[1])) {
      const [sh, sm] = r.startTime.split(":").map(Number);
      const mid = sh * 60 + sm + 60;
      const midTime = `${String(Math.floor(mid / 60)).padStart(2, "0")}:${String(mid % 60).padStart(2, "0")}`;
      return [
        { ...r, court: r.court[0], endTime: midTime, duration: 1 },
        { ...r, court: r.court[1], startTime: midTime, duration: 1 },
      ];
    }
    return [r];
  });

  const courtRecords = expanded.filter(
    (r) =>
      isValidCourt(r.court) &&
      r.remark !== "จองสนามเอง" &&
      r.classType !== "Parent Class" &&
      !r.staCourt
  );
  const weeks = withFullYearWeeks(groupByWeek(courtRecords), new Date().getFullYear());

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  let defaultWeek = 0;
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].weekStart <= today) defaultWeek = i;
    else break;
  }

  return <CourtMonitor weeks={weeks} defaultWeek={defaultWeek} />;
}
