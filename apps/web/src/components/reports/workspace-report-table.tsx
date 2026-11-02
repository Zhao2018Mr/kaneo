import { useTranslation } from "react-i18next";
import type { buildWorkspaceReport } from "./workspace-report";
import { WorkspaceReportRow } from "./workspace-report-row";

type Props = {
  report: ReturnType<typeof buildWorkspaceReport>;
  onSelect: (projectId: string, statusKey: string) => void;
};

export function WorkspaceReportTable({ report, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="report-summary-title">
      <h2 id="report-summary-title" className="text-base font-semibold">
        {t("tasks:reports.projectSummary")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("tasks:reports.tableHint")}
      </p>
      <div
        className="mt-3 overflow-x-auto rounded-lg border border-border"
        role="region"
        aria-label={t("tasks:reports.projectSummary")}
      >
        <table className="w-full whitespace-nowrap text-sm">
          <caption className="sr-only">
            {t("tasks:reports.projectSummary")}
          </caption>
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-background px-4 py-3 text-left"
              >
                {t("tasks:reports.project")}
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                {t("tasks:reports.total")}
              </th>
              {report.statuses.map((status) => (
                <th
                  key={status.key}
                  scope="col"
                  className="px-3 py-3 text-right"
                >
                  {status.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.projects.map((project) => (
              <WorkspaceReportRow
                key={project.id}
                project={project}
                statuses={report.statuses}
                onSelect={onSelect}
              />
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/30 font-semibold">
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-background px-4 py-3 text-left"
              >
                {t("tasks:reports.allProjects")}
              </th>
              <td className="px-3 py-2 text-right tabular-nums">
                <button
                  type="button"
                  className="min-h-9 min-w-9 rounded px-2 text-primary hover:bg-accent"
                  onClick={() => onSelect("", "")}
                >
                  {report.total}
                </button>
              </td>
              {report.statuses.map((status) => (
                <td
                  key={status.key}
                  className="px-3 py-2 text-right tabular-nums"
                >
                  <button
                    type="button"
                    className="min-h-9 min-w-9 rounded px-2 text-primary hover:bg-accent"
                    aria-label={t("tasks:reports.viewStatus", {
                      project: t("tasks:reports.allProjects"),
                      status: status.label,
                      count: report.counts.get(status.key) ?? 0,
                    })}
                    onClick={() => onSelect("", status.key)}
                  >
                    {report.counts.get(status.key) ?? 0}
                  </button>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
