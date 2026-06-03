import { getBookingRows } from "@/lib/sheets";
import { parseRecords, groupByWeek, withFullYearWeeks } from "@/lib/parse";
import ScheduleView from "@/components/ScheduleView";

export const revalidate = 0;

export default async function SchedulePage() {
  const rows = await getBookingRows();
  const all = parseRecords(rows);
  const weeks = withFullYearWeeks(groupByWeek(all), new Date().getFullYear());

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  let defaultWeek = 0;
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].weekStart <= today) defaultWeek = i;
    else break;
  }

  return <ScheduleView weeks={weeks} defaultWeek={defaultWeek} />;
}
