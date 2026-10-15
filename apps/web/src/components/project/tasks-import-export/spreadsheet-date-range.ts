// Calendar arithmetic keeps the end day inclusive even across daylight-saving changes.
import { addDays, format, isValid, parseISO } from "date-fns";
import type { SpreadsheetExportRange } from "@/fetchers/task/export-spreadsheet-data";
/** Converts local inclusive calendar days to API instants, or null for missing or invalid dates. */
export function spreadsheetDateRange(
  dateField: SpreadsheetExportRange["dateField"],
  from: string,
  to: string,
): SpreadsheetExportRange | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return null;
  const first = parseISO(from),
    last = parseISO(to);
  if (
    !isValid(first) ||
    !isValid(last) ||
    format(first, "yyyy-MM-dd") !== from ||
    format(last, "yyyy-MM-dd") !== to ||
    first > last
  )
    return null;
  return {
    dateField,
    from: first.toISOString(),
    until: addDays(last, 1).toISOString(),
  };
}
