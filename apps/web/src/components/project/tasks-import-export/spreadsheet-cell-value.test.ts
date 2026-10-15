import { describe, expect, it } from "vite-plus/test";
import { spreadsheetCellValue } from "./spreadsheet-cell-value";

describe("spreadsheet field values", () => {
  it("preserves booleans and joins valid multiple selections", () => {
    expect(spreadsheetCellValue("boolean", "false")).toBe(false);
    expect(spreadsheetCellValue("boolean", "true")).toBe(true);
    expect(spreadsheetCellValue("multiselect", '["需求","缺陷"]')).toBe(
      "需求、缺陷",
    );
  });
  it("preserves invalid legacy data and formula-like text literally", () => {
    expect(spreadsheetCellValue("number", "not a number")).toBe("not a number");
    expect(spreadsheetCellValue("number", "1e999")).toBe("1e999");
    expect(spreadsheetCellValue("multiselect", "invalid JSON")).toBe(
      "invalid JSON",
    );
    expect(spreadsheetCellValue("multiselect", '[1,"需求"]')).toBe(
      '[1,"需求"]',
    );
    expect(spreadsheetCellValue("text", "=1+1")).toBe("=1+1");
    expect(spreadsheetCellValue("number", " ")).toBeNull();
  });
});
