import { getBookingRows } from "@/lib/sheets";
import { parseRecords, groupByWeek } from "@/lib/parse";
import ScheduleView from "@/components/ScheduleView";

export const revalidate = 300;

export default async function SchedulePage() {
  const rows = await getBookingRows();
  const all = parseRecords(rows);
  const weeks = groupByWeek(all);

  const today = new Date().toISOString().split("T")[0];
  let defaultWeek = 0;
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].weekStart <= today) defaultWeek = i;
    else break;
  }

  return <ScheduleView weeks={weeks} defaultWeek={defaultWeek} />;
}
