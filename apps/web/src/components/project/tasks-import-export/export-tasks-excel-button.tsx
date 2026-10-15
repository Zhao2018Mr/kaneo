// Both entry points use one dialog; no export request runs until Download is confirmed.
import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { ExportTasksExcelDialog } from "./export-tasks-excel-dialog";

export function ExportTasksExcelButton({
  projectId,
  projectSlug,
  compact = false,
}: {
  projectId: string;
  projectSlug: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={compact ? "h-7 shrink-0 px-2" : undefined}
            aria-label={t("settings:excelExport.action")}
            title={t("settings:excelExport.action")}
          />
        }
      >
        <FileSpreadsheet aria-hidden="true" />
        <span className={compact ? "hidden sm:inline" : undefined}>
          {t("settings:excelExport.action")}
        </span>
      </DialogTrigger>
      {open && (
        <ExportTasksExcelDialog
          projectId={projectId}
          projectSlug={projectSlug}
          onExported={() => setOpen(false)}
        />
      )}
    </Dialog>
  );
}
