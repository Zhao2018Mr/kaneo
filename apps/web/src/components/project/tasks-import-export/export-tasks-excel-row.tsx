// Loads the spreadsheet writer only after the user requests an XLSX download.
import { useMutation } from "@tanstack/react-query";
import { saveAs } from "file-saver";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import exportSpreadsheetData from "@/fetchers/task/export-spreadsheet-data";
import { toast } from "@/lib/toast";

export function ExportTasksExcelRow({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) {
  const { t } = useTranslation();
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const [{ createTaskWorkbook }, data] = await Promise.all([
        import("./task-workbook"),
        exportSpreadsheetData(projectId),
      ]);
      const workbook = createTaskWorkbook(data, (key) => String(t(key)));
      const bytes = await workbook.xlsx.writeBuffer();
      const blob = new Blob([new Uint8Array(bytes)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const safeSlug =
        projectSlug.replace(/[\\/:*?"<>|\p{Cc}]/gu, "-").slice(0, 100) ||
        "project";
      saveAs(
        blob,
        `${safeSlug}-tasks-${data.project.exportedAt.slice(0, 10)}.xlsx`,
      );
    },
    onSuccess: () => toast.success(t("settings:excelExport.success")),
    onError: (cause) =>
      toast.error(
        cause instanceof Error
          ? cause.message
          : t("settings:excelExport.error"),
      ),
  });
  return (
    <SettingsRow
      stack
      icon={<FileSpreadsheet />}
      title={t("settings:excelExport.title")}
      description={t("settings:excelExport.description")}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => mutate()}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="animate-spin" /> : null}
        {t(
          isPending
            ? "settings:excelExport.pending"
            : "settings:excelExport.action",
        )}
      </Button>
    </SettingsRow>
  );
}
