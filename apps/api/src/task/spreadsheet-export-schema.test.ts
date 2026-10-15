// Export dates must be complete and unambiguous before a query reaches PostgreSQL.
import { describe, expect, it } from "vite-plus/test";
import { spreadsheetExportQuery } from "./spreadsheet-export-schema";
const range = {
  dateField: "createdAt",
  from: "2026-10-14T16:00:00.000Z",
  until: "2026-10-15T16:00:00.000Z",
};
describe("spreadsheet export query", () => {
  it("accepts all tasks or one complete date range", () => {
    expect(spreadsheetExportQuery.safeParse({}).success).toBe(true);
    for (const dateField of ["createdAt", "updatedAt", "startDate", "dueDate"])
      expect(
        spreadsheetExportQuery.safeParse({ ...range, dateField }).success,
      ).toBe(true);
  });
  it("rejects partial, invalid and reversed ranges", () => {
    for (const input of [
      { from: range.from },
      { ...range, dateField: "deletedAt" },
      { ...range, from: "bad date" },
      { ...range, from: "2026-02-30T00:00:00Z" },
      { ...range, until: range.from },
      { ...range, from: range.until, until: range.from },
    ])
      expect(spreadsheetExportQuery.safeParse(input).success).toBe(false);
  });
});
