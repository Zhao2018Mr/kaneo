// Read back real XLSX bytes to verify numeric values, literal text and complete exports.
import ExcelJS from "exceljs";
import { describe, expect, it } from "vite-plus/test";
import type { SpreadsheetExportData } from "@/fetchers/task/export-spreadsheet-data";
import { createTaskWorkbook } from "./task-workbook";

const timestamp = "2026-10-15T08:00:00.000Z";
function fixture(): SpreadsheetExportData {
  return {
    project: {
      id: "p",
      name: "项目",
      slug: "KAN",
      description: null,
      exportedAt: timestamp,
    },
    columns: [
      {
        id: "c",
        projectId: "p",
        name: "待测试",
        slug: "in-review",
        position: 0,
        icon: null,
        color: null,
        isFinal: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    fields: ["开发工时（小时）", "测试工时（小时）", "未填工时"].map(
      (name, i) => ({
        id: `f${i}`,
        projectId: "p",
        name,
        type: "number",
        required: false,
        defaultValue: "9",
        options: null,
        position: i,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ),
    tasks: [
      {
        id: "t",
        projectId: "p",
        number: 1,
        position: 0,
        userId: null,
        title: '=HYPERLINK("https://example.test")',
        description: "需求内容",
        status: "in-review",
        priority: "low",
        assigneeName: null,
        startDate: null,
        dueDate: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        labels: ["功能需求"],
        customFieldValues: { f0: "1.25", f1: "0" },
      },
    ],
  };
}

const t = (key: string) => key.split(".").at(-1)!;

describe("task workbook", () => {
  it("writes real numeric hours, preserves missing values and treats formula-like titles as text", async () => {
    const source = fixture();
    const workbook = createTaskWorkbook(source, t);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = loaded.worksheets[0];
    const headings = sheet.getRow(1).values as string[];
    expect(sheet.getCell(2, headings.indexOf("开发工时（小时）")).value).toBe(
      1.25,
    );
    expect(sheet.getCell(2, headings.indexOf("测试工时（小时）")).value).toBe(
      0,
    );
    expect(sheet.getCell(2, headings.indexOf("未填工时")).value).toBeNull();
    expect(sheet.getCell(2, headings.indexOf("titleColumn")).value).toBe(
      source.tasks[0].title,
    );
    expect(sheet.getCell(2, headings.indexOf("titleColumn")).type).toBe(
      ExcelJS.ValueType.String,
    );
    expect(sheet.getCell(2, headings.indexOf("status")).value).toBe("待测试");
    expect(sheet.views[0].state).toBe("frozen");
    expect(sheet.autoFilter).toBeTruthy();
    expect(loaded.worksheets).toHaveLength(2);
  });

  it("exports an empty project with headings and configuration sheets", () => {
    const source = fixture();
    source.tasks = [];
    const workbook = createTaskWorkbook(source, t);
    expect(workbook.worksheets[0].rowCount).toBe(1);
    expect(workbook.worksheets[0].getCell("A1").value).toBe("ticket");
    expect(workbook.worksheets[1].rowCount).toBeGreaterThan(1);
  });

  it("preserves complete long descriptions in ordered text chunks", async () => {
    const source = fixture();
    const original = "😀说明".repeat(20_000);
    source.tasks[0].description = original;
    const workbook = createTaskWorkbook(source, t);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const long = loaded.getWorksheet("longTextSheet")!;
    const chunks: string[] = [];
    long.eachRow((row, i) => {
      if (i > 1) chunks.push(String(row.getCell(4).value));
    });
    expect(chunks.join("")).toBe(original);
    expect(chunks.every((chunk) => chunk.length <= 30_000)).toBe(true);
  });
});
