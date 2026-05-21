import { getBookingRows } from "@/lib/sheets";
import { parseRecords, groupByWeek, isValidCourt } from "@/lib/parse";
import CourtMonitor from "@/components/CourtMonitor";

export const revalidate = 300;

export default async function CourtsPage() {
  const rows = await getBookingRows();
  const all = parseRecords(rows);
  const courtRecords = all.filter((r) => isValidCourt(r.court));
  const weeks = groupByWeek(courtRecords);

  const today = new Date().toISOString().split("T")[0];
  let defaultWeek = 0;
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].weekStart <= today) defaultWeek = i;
    else break;
  }

  return <CourtMonitor weeks={weeks} defaultWeek={defaultWeek} />;
}
