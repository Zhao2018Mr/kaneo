// Inclusive calendar days become an exclusive next-day boundary in the browser timezone.
import { describe, expect, it } from "vite-plus/test";
import { spreadsheetDateRange } from "./spreadsheet-date-range";
describe("spreadsheet date range", () => {
  it("uses the next local midnight across a daylight-saving transition", () => {
    expect(
      spreadsheetDateRange("createdAt", "2026-11-01", "2026-11-01"),
    ).toEqual({
      dateField: "createdAt",
      from: new Date(2026, 10, 1).toISOString(),
      until: new Date(2026, 10, 2).toISOString(),
    });
  });
  it("includes the whole final day and preserves the selected date type", () => {
    expect(
      spreadsheetDateRange("updatedAt", "2026-10-15", "2026-10-15"),
    ).toEqual({
      dateField: "updatedAt",
      from: new Date(2026, 9, 15).toISOString(),
      until: new Date(2026, 9, 16).toISOString(),
    });
  });
  it("rejects blank, impossible and reversed dates", () => {
    for (const [from, to] of [
      ["", "2026-10-15"],
      ["2026-02-30", "2026-10-15"],
      ["2026-10-16", "2026-10-15"],
    ])
      expect(spreadsheetDateRange("createdAt", from!, to!)).toBeNull();
  });
});
