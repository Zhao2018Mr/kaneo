// Reuses settings dialogs to preview and copy a template without duplicating tasks.
import { Copy } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useCopyProjectConfiguration from "@/hooks/mutations/project/use-copy-project-configuration";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useGetCustomFieldsByProject from "@/hooks/queries/custom-field/use-get-custom-fields-by-project";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { toast } from "@/lib/toast";
import { CopyProjectConfigurationPreview } from "./copy-project-configuration-preview";

type Props = { projectId: string; workspaceId: string; hasTasks: boolean };

export function CopyProjectConfigurationRow({
  projectId,
  workspaceId,
  hasTasks,
}: Props) {
  const { t } = useTranslation();
  const selectId = useId();
  const workflowId = useId();
  const fieldsId = useId();
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [workflow, setWorkflow] = useState(!hasTasks);
  const [customFields, setCustomFields] = useState(true);
  const [error, setError] = useState("");
  const projects = useGetProjects({ workspaceId });
  const sources =
    projects.data?.filter((p) => p.id !== projectId && !p.archivedAt) ?? [];
  const source = sources.find((p) => p.id === sourceId);
  const columns = useGetColumns(open ? sourceId : "");
  const fields = useGetCustomFieldsByProject(open ? sourceId : "");
  const copy = useCopyProjectConfiguration();
  const previewReady =
    !!source &&
    columns.data !== undefined &&
    fields.data !== undefined &&
    !columns.isError &&
    !fields.isError;
  const copyWorkflow = workflow && !hasTasks;

  const handleOpenChange = (next: boolean) => {
    if (copy.isPending) return;
    setOpen(next);
    setSourceId("");
    setWorkflow(!hasTasks);
    setCustomFields(true);
    setError("");
  };
  const handleCopy = async () => {
    if (!previewReady || copy.isPending || (!copyWorkflow && !customFields))
      return;
    setError("");
    try {
      const result = await copy.mutateAsync({
        id: projectId,
        sourceProjectId: sourceId,
        workflow: copyWorkflow,
        customFields,
      });
      toast.success(
        t("settings:projectGeneral.copyConfiguration.success", {
          columns: result.columnsCopied,
          fields: result.fieldsCopied,
          skipped: result.fieldsSkipped,
        }),
      );
      setOpen(false);
      setSourceId("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("settings:projectGeneral.copyConfiguration.error"),
      );
    }
  };

  return (
    <SettingsRow
      stack
      icon={<Copy />}
      title={t("settings:projectGeneral.copyConfiguration.title")}
      description={t("settings:projectGeneral.copyConfiguration.description")}
    >
      {projects.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {t("settings:projectGeneral.copyConfiguration.loadError")}
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={projects.isPending || sources.length === 0}
          onClick={() => handleOpenChange(true)}
        >
          {t("settings:projectGeneral.copyConfiguration.action")}
        </Button>
      )}
      {!projects.isPending && !projects.isError && sources.length === 0 ? (
        <span className="text-xs text-muted-foreground">
          {t("settings:projectGeneral.copyConfiguration.noTemplates")}
        </span>
      ) : null}
      <ConfirmDialog
        open={open}
        onOpenChange={handleOpenChange}
        destructive={false}
        title={t("settings:projectGeneral.copyConfiguration.title")}
        description={t(
          "settings:projectGeneral.copyConfiguration.dialogDescription",
        )}
        confirmLabel={t("settings:projectGeneral.copyConfiguration.confirm")}
        pendingLabel={t("settings:projectGeneral.copyConfiguration.pending")}
        pending={copy.isPending}
        confirmDisabled={!previewReady || (!copyWorkflow && !customFields)}
        onConfirm={handleCopy}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={selectId}>
              {t("settings:projectGeneral.copyConfiguration.template")}
            </Label>
            <Select
              value={sourceId}
              disabled={copy.isPending}
              onValueChange={(value) => {
                setSourceId(value ?? "");
                setError("");
              }}
            >
              <SelectTrigger id={selectId}>
                <SelectValue
                  placeholder={t(
                    "settings:projectGeneral.copyConfiguration.placeholder",
                  )}
                >
                  {source?.name ??
                    t("settings:projectGeneral.copyConfiguration.placeholder")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sources.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={workflowId}
              checked={copyWorkflow}
              disabled={hasTasks || copy.isPending}
              onCheckedChange={(checked) => setWorkflow(checked)}
            />
            <Label htmlFor={workflowId}>
              {t("settings:projectGeneral.copyConfiguration.workflow")}
            </Label>
          </div>
          {hasTasks ? (
            <p className="text-xs text-muted-foreground">
              {t("settings:projectGeneral.copyConfiguration.hasTasks")}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Checkbox
              id={fieldsId}
              checked={customFields}
              disabled={copy.isPending}
              onCheckedChange={(checked) => setCustomFields(checked)}
            />
            <Label htmlFor={fieldsId}>
              {t("settings:projectGeneral.copyConfiguration.fields")}
            </Label>
          </div>
          {sourceId ? (
            <CopyProjectConfigurationPreview
              columns={columns.data}
              fields={fields.data}
              failed={columns.isError || fields.isError}
            />
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </ConfirmDialog>
    </SettingsRow>
  );
}
