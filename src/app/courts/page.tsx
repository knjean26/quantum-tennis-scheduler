import { getBookingRows } from "@/lib/sheets";
import { parseRecords, groupByWeek, isValidCourt } from "@/lib/parse";
import CourtMonitor from "@/components/CourtMonitor";

export const dynamic = "force-dynamic";

export default async function CourtsPage() {
  const rows = await getBookingRows();
  const all = parseRecords(rows);
  const courtRecords = all.filter(
    (r) =>
      isValidCourt(r.court) &&
      r.remark !== "จองสนามเอง" &&
      r.remark !== "ขายสนาม" &&
      r.classType !== "Parent Class"
  );
  const weeks = groupByWeek(courtRecords);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  let defaultWeek = 0;
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].weekStart <= today) defaultWeek = i;
    else break;
  }

  return <CourtMonitor weeks={weeks} defaultWeek={defaultWeek} />;
}
