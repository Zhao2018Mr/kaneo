// Builds spreadsheet reports in the browser; no task data is sent to a conversion service.
import ExcelJS from "exceljs";
import { format } from "date-fns";
import type { SpreadsheetExportData } from "@/fetchers/task/export-spreadsheet-data";
import { spreadsheetCellValue } from "./spreadsheet-cell-value";

type Translate = (key: string) => string;
const baseColumns = [
  "ticket",
  "id",
  "titleColumn",
  "descriptionColumn",
  "status",
  "priority",
  "assignee",
  "labels",
  "startDate",
  "dueDate",
  "createdAt",
  "updatedAt",
] as const;

function styleHeader(row: ExcelJS.Row) {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { name: "Aptos", bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF243B53" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

/**
 * Builds an XLSX-ready workbook from one complete export snapshot.
 * All user strings remain literal cells. Long strings are preserved in a
 * separate sheet; missing field values are never replaced with defaults.
 */
export function createTaskWorkbook(
  data: SpreadsheetExportData,
  translate: Translate,
) {
  const t = (key: string) => translate(`settings:excelExport.${key}`);
  if (
    data.tasks.length > 1_048_575 ||
    baseColumns.length + data.fields.length > 16_384
  )
    throw new Error(t("tooLarge"));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kaneo";
  workbook.created = new Date(data.project.exportedAt);
  const taskSheet = workbook.addWorksheet(t("taskSheet"), {
    views: [{ state: "frozen", ySplit: 1, xSplit: 2 }],
  });
  const config = workbook.addWorksheet(t("configSheet"), {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const longText: Array<[string, string, number, string]> = [];
  const text = (value: string, owner: string, field: string) => {
    if (value.length <= 30_000) return value;
    let offset = 0,
      part = 1;
    while (offset < value.length) {
      let end = Math.min(offset + 30_000, value.length);
      // Do not split a surrogate pair, which would lose non-BMP characters in XML.
      if (end < value.length && /[\uD800-\uDBFF]/.test(value[end - 1] ?? ""))
        end--;
      longText.push([owner, field, part++, value.slice(offset, end)]);
      offset = end;
    }
    return `${value.slice(0, 120).replace(/[\uD800-\uDBFF]$/, "")}… ${t("longTextNotice")}`;
  };
  const date = (value: string | null) =>
    value ? format(new Date(value), "yyyy-MM-dd HH:mm:ss") : null;
  const fields = [...data.fields].sort((a, b) => a.position - b.position);
  taskSheet.columns = [
    ...baseColumns.map((key) => ({
      width:
        key === "descriptionColumn"
          ? 56
          : key === "titleColumn"
            ? 42
            : key === "id"
              ? 28
              : 22,
    })),
    ...fields.map((field) => ({ width: field.type === "number" ? 18 : 28 })),
  ];
  styleHeader(
    taskSheet.addRow([
      ...baseColumns.map(t),
      ...fields.map((field) => field.name.slice(0, 200)),
    ]),
  );
  const statuses = new Map(
    data.columns.map((column) => [column.slug, column.name]),
  );
  for (const task of data.tasks) {
    const ticket =
      task.number == null ? task.id : `${data.project.slug}-${task.number}`;
    const status =
      statuses.get(task.status) ??
      (["archived", "planned"].includes(task.status)
        ? t(task.status)
        : task.status);
    const cells = [
      ticket,
      task.id,
      task.title,
      task.description,
      status,
      t(`priorities.${task.priority}`),
      task.assigneeName,
      task.labels.join("、"),
      date(task.startDate),
      date(task.dueDate),
      date(task.createdAt),
      date(task.updatedAt),
      ...fields.map((field) =>
        spreadsheetCellValue(field.type, task.customFieldValues[field.id]),
      ),
    ];
    const row = taskSheet.addRow(
      cells.map((value, i) =>
        typeof value === "string"
          ? text(
              value,
              ticket,
              i < baseColumns.length
                ? t(baseColumns[i]!)
                : fields[i - baseColumns.length]!.name,
            )
          : value,
      ),
    );
    row.height = 42;
    row.alignment = { vertical: "top", wrapText: true };
    row.font = { name: "Aptos", size: 11 };
    fields.forEach((field, i) => {
      if (field.type === "number")
        row.getCell(baseColumns.length + i + 1).numFmt = "0.###############";
    });
  }
  taskSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, taskSheet.rowCount), column: taskSheet.columnCount },
  };

  config.columns = [
    { width: 26 },
    { width: 42 },
    { width: 28 },
    { width: 28 },
    { width: 52 },
  ];
  styleHeader(
    config.addRow([
      t("project"),
      text(data.project.name, data.project.id, t("project")),
    ]),
  );
  config.addRow([
    t("projectDescription"),
    text(
      data.project.description ?? "",
      data.project.id,
      t("projectDescription"),
    ),
  ]);
  config.addRow([t("exportedAt"), date(data.project.exportedAt)]);
  config.addRow([
    t("timezone"),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ]);
  config.addRow([t("scope"), data.range ? t("dateRange") : t("allTasks")]);
  if (data.range) {
    config.addRow([t("dateField"), t(data.range.dateField)]);
    config.addRow([
      t("fromDay"),
      format(new Date(data.range.from), "yyyy-MM-dd"),
    ]);
    config.addRow([
      t("toDay"),
      format(new Date(Date.parse(data.range.until) - 1), "yyyy-MM-dd"),
    ]);
  }
  config.addRow([t("taskCount"), data.tasks.length]);
  config.addRow([]);
  styleHeader(
    config.addRow([t("order"), t("status"), t("statusKey"), t("final")]),
  );
  [...data.columns]
    .sort((a, b) => a.position - b.position)
    .forEach((column, i) =>
      config.addRow([
        i + 1,
        text(column.name, column.id, t("status")),
        column.slug,
        column.isFinal,
      ]),
    );
  config.addRow([]);
  styleHeader(
    config.addRow([
      t("fieldName"),
      t("fieldType"),
      t("required"),
      t("defaultValue"),
      t("options"),
    ]),
  );
  fields.forEach((field) =>
    config.addRow([
      text(field.name, field.id, t("fieldName")),
      field.type,
      field.required,
      text(field.defaultValue ?? "", field.id, t("defaultValue")),
      text(
        Array.isArray(field.options) ? field.options.join("、") : "",
        field.id,
        t("options"),
      ),
    ]),
  );
  config.eachRow((row, i) => {
    if (i !== 1) row.alignment = { vertical: "top", wrapText: true };
  });
  if (longText.length) {
    if (longText.length > 1_048_575) throw new Error(t("tooLarge"));
    const sheet = workbook.addWorksheet(t("longTextSheet"), {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = [
      { width: 26 },
      { width: 28 },
      { width: 12 },
      { width: 100 },
    ];
    styleHeader(
      sheet.addRow([t("ticket"), t("fieldName"), t("part"), t("content")]),
    );
    longText.forEach((values) => {
      const row = sheet.addRow(values);
      row.alignment = { vertical: "top", wrapText: true };
      row.height = 90;
    });
  }
  return workbook;
}
