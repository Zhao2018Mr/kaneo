// Shared download behavior keeps the project header and settings entry consistent.
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";
import exportSpreadsheetData, {
  type SpreadsheetExportRange,
} from "@/fetchers/task/export-spreadsheet-data";
import { toast } from "@/lib/toast";

export function useExportTasksExcel(
  projectId: string,
  projectSlug: string,
  onExported: () => void,
) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (range: SpreadsheetExportRange | undefined) => {
      const [{ createTaskWorkbook }, data] = await Promise.all([
        import("./task-workbook"),
        exportSpreadsheetData(projectId, range),
      ]);
      const bytes = await createTaskWorkbook(data, (key) =>
        String(t(key)),
      ).xlsx.writeBuffer();
      const blob = new Blob([new Uint8Array(bytes)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const safeSlug =
        projectSlug.replace(/[\\/:*?"<>|\p{Cc}]/gu, "-").slice(0, 100) ||
        "project";
      const suffix = range
        ? `${range.dateField}-${format(new Date(range.from), "yyyy-MM-dd")}-${format(new Date(Date.parse(range.until) - 1), "yyyy-MM-dd")}`
        : data.project.exportedAt.slice(0, 10);
      saveAs(blob, `${safeSlug}-tasks-${suffix}.xlsx`);
    },
    onSuccess: () => {
      toast.success(t("settings:excelExport.success"));
      onExported();
    },
    onError: (cause) =>
      toast.error(
        cause instanceof Error
          ? cause.message
          : t("settings:excelExport.error"),
      ),
  });
}
