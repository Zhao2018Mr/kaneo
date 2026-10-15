// Keeps template contents visible before the user confirms the copy.
import { useTranslation } from "react-i18next";

type Props = {
  columns?: { name: string }[];
  fields?: { name: string }[];
  failed: boolean;
};

export function CopyProjectConfigurationPreview({
  columns,
  fields,
  failed,
}: Props) {
  const { t } = useTranslation();
  return (
    <div
      aria-live="polite"
      className="max-h-32 space-y-2 overflow-y-auto rounded-md border p-3 text-xs text-muted-foreground"
    >
      {failed ? (
        <p role="alert">
          {t("settings:projectGeneral.copyConfiguration.loadError")}
        </p>
      ) : columns && fields ? (
        <>
          <p>
            {t("settings:projectGeneral.copyConfiguration.workflow")}:{" "}
            {columns.map((c) => c.name).join(" → ") ||
              t("settings:projectGeneral.copyConfiguration.none")}
          </p>
          <p>
            {t("settings:projectGeneral.copyConfiguration.fields")}:{" "}
            {fields.map((f) => f.name).join("、") ||
              t("settings:projectGeneral.copyConfiguration.none")}
          </p>
        </>
      ) : (
        <p>{t("settings:projectGeneral.copyConfiguration.loading")}</p>
      )}
    </div>
  );
}
