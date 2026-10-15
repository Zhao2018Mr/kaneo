// Calendar dates use the browser timezone; the API receives precise half-open instants.
import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SpreadsheetExportRange } from "@/fetchers/task/export-spreadsheet-data";
import { spreadsheetDateRange } from "./spreadsheet-date-range";
import { useExportTasksExcel } from "./use-export-tasks-excel";

const dateFields = ["createdAt", "updatedAt", "startDate", "dueDate"] as const;
const dateLabels = {
  createdAt: "settings:excelExport.createdAt",
  updatedAt: "settings:excelExport.updatedAt",
  startDate: "settings:excelExport.startDate",
  dueDate: "settings:excelExport.dueDate",
} as const;

export function ExportTasksExcelDialog({
  projectId,
  projectSlug,
  onExported,
}: {
  projectId: string;
  projectSlug: string;
  onExported: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [scope, setScope] = useState("all");
  const [dateField, setDateField] =
    useState<SpreadsheetExportRange["dateField"]>("createdAt");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = spreadsheetDateRange(dateField, from, to);
  const { mutate, isPending } = useExportTasksExcel(
    projectId,
    projectSlug,
    onExported,
  );
  return (
    <DialogPopup className="max-w-md">
      <form
        className="flex min-h-0 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (isPending) return;
          if (scope === "all") mutate(undefined);
          else if (range) mutate(range);
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("settings:excelExport.title")}</DialogTitle>
          <DialogDescription>
            {t("settings:excelExport.dialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <fieldset disabled={isPending} className="space-y-3">
            <legend className="mb-2 text-sm font-medium">
              {t("settings:excelExport.scope")}
            </legend>
            <RadioGroup
              value={scope}
              onValueChange={(value) => setScope(String(value))}
              className="flex-row flex-wrap gap-5"
            >
              <Label htmlFor={`${id}-all`} className="flex items-center gap-2">
                <Radio id={`${id}-all`} value="all" />
                {t("settings:excelExport.allTasksLabel")}
              </Label>
              <Label
                htmlFor={`${id}-range`}
                className="flex items-center gap-2"
              >
                <Radio id={`${id}-range`} value="range" />
                {t("settings:excelExport.dateRange")}
              </Label>
            </RadioGroup>
          </fieldset>
          {scope === "range" && (
            <fieldset disabled={isPending} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${id}-field`}>
                  {t("settings:excelExport.dateField")}
                </Label>
                <Select
                  value={dateField}
                  onValueChange={(value) => {
                    const selected = dateFields.find(
                      (field) => field === value,
                    );
                    if (selected) setDateField(selected);
                  }}
                >
                  <SelectTrigger id={`${id}-field`}>
                    <SelectValue>{t(dateLabels[dateField])}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {dateFields.map((field) => (
                      <SelectItem key={field} value={field}>
                        {t(dateLabels[field])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${id}-from`}>
                    {t("settings:excelExport.fromDay")}
                  </Label>
                  <Input
                    nativeInput
                    id={`${id}-from`}
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    aria-describedby={`${id}-hint`}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-to`}>
                    {t("settings:excelExport.toDay")}
                  </Label>
                  <Input
                    nativeInput
                    id={`${id}-to`}
                    type="date"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    aria-describedby={`${id}-hint`}
                    min={from || undefined}
                    required
                  />
                </div>
              </div>
              <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                {t("settings:excelExport.dateHint", {
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                })}
              </p>
              {from && to && !range && (
                <p role="alert" className="text-xs text-destructive">
                  {t("settings:excelExport.invalidRange")}
                </p>
              )}
            </fieldset>
          )}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("common:actions.cancel")}
          </DialogClose>
          <Button
            type="submit"
            disabled={isPending || (scope === "range" && !range)}
          >
            {isPending && (
              <Loader2 className="animate-spin" aria-hidden="true" />
            )}
            {t(
              isPending
                ? "settings:excelExport.pending"
                : "settings:excelExport.download",
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogPopup>
  );
}
