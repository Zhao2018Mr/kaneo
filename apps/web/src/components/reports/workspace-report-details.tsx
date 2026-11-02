import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { buildWorkspaceReport } from "./workspace-report";

type Props = {
  report: ReturnType<typeof buildWorkspaceReport>;
  projectId: string;
  statusKey: string;
  onSelect: (projectId: string, statusKey: string) => void;
  onOpenTask: (id: string) => void;
};
const PAGE_SIZE = 50;

export function WorkspaceReportDetails({
  report,
  projectId,
  statusKey,
  onSelect,
  onOpenTask,
}: Props) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const tasks = report.tasks.filter(
    (entry) =>
      (!projectId || entry.projectId === projectId) &&
      (!statusKey || entry.statusKey === statusKey),
  );
  const lastPage = Math.max(0, Math.ceil(tasks.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const visibleTasks = tasks.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  return (
    <section aria-labelledby="report-details-title" className="scroll-mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="report-details-title"
          className="mr-auto text-base font-semibold"
        >
          {t("tasks:reports.details")} ({tasks.length})
        </h2>
        <select
          aria-label={t("tasks:reports.projectFilter")}
          value={projectId}
          onChange={(event) => onSelect(event.target.value, statusKey)}
          className="h-9 max-w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">{t("tasks:reports.allProjects")}</option>
          {report.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t("tasks:reports.statusFilter")}
          value={statusKey}
          onChange={(event) => onSelect(projectId, event.target.value)}
          className="h-9 max-w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">{t("tasks:reports.allStatuses")}</option>
          {report.statuses.map((status) => (
            <option key={status.key} value={status.key}>
              {status.label}
            </option>
          ))}
        </select>
      </div>
      <div
        className="mt-3 overflow-x-auto rounded-lg border border-border"
        role="region"
        aria-label={t("tasks:reports.details")}
      >
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="sr-only">{t("tasks:reports.details")}</caption>
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                {t("tasks:reports.project")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("tasks:reports.requirement")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("tasks:reports.status")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("tasks:reports.assignee")}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleTasks.map((entry) => (
              <tr
                key={`${entry.projectId}:${entry.task.id}`}
                className="border-t border-border"
              >
                <td className="max-w-48 px-4 py-3">
                  <span className="block truncate" title={entry.projectName}>
                    {entry.projectName}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    className="min-h-9 text-left text-primary hover:underline"
                    onClick={() => onOpenTask(entry.task.id)}
                  >
                    <span className="mr-2 text-xs text-muted-foreground">
                      {entry.projectSlug}-{entry.task.number ?? "—"}
                    </span>
                    {entry.task.title}
                  </button>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {entry.statusLabel}
                </td>
                <td className="px-4 py-3">
                  {entry.task.assigneeName || t("tasks:reports.unassigned")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 && (
          <p
            role="status"
            className="px-4 py-8 text-center text-sm text-muted-foreground"
          >
            {t("tasks:reports.noMatchingTasks")}
          </p>
        )}
      </div>
      {tasks.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-end gap-3 text-sm">
          <span>
            {t("tasks:reports.page", {
              current: currentPage + 1,
              total: lastPage + 1,
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            {t("tasks:reports.previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === lastPage}
            onClick={() => setPage(currentPage + 1)}
          >
            {t("tasks:reports.next")}
          </Button>
        </div>
      )}
    </section>
  );
}
