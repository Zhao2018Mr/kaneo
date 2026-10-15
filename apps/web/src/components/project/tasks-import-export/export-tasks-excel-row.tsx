// Settings keeps a shortcut to the same export options as the project header.
import { FileSpreadsheet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { ExportTasksExcelButton } from "./export-tasks-excel-button";
export function ExportTasksExcelRow({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) {
  const { t } = useTranslation();
  return (
    <SettingsRow
      stack
      icon={<FileSpreadsheet />}
      title={t("settings:excelExport.title")}
      description={t("settings:excelExport.description")}
    >
      <ExportTasksExcelButton projectId={projectId} projectSlug={projectSlug} />
    </SettingsRow>
  );
}
