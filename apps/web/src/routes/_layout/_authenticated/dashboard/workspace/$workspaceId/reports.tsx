import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { buildWorkspaceReport } from "@/components/reports/workspace-report";
import { WorkspaceReportDetails } from "@/components/reports/workspace-report-details";
import { WorkspaceReportTable } from "@/components/reports/workspace-report-table";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Button } from "@/components/ui/button";
import { useWorkspaceProjectBoards } from "@/hooks/queries/workspace/use-workspace-project-boards";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/reports",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { taskId?: string } => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const data = useWorkspaceProjectBoards(workspaceId);
  const report = buildWorkspaceReport(
    data.projectBoards.flatMap(({ project, board }) =>
      board
        ? [
            {
              ...board,
              id: project.id,
              name: project.name,
              slug: project.slug,
            },
          ]
        : [],
    ),
    getStatusDisplayLabel,
  );
  const [selection, setSelection] = useState({
    workspaceId,
    projectId: "",
    statusKey: "",
  });
  const projectId =
    selection.workspaceId === workspaceId &&
    report.projects.some((project) => project.id === selection.projectId)
      ? selection.projectId
      : "";
  const statusKey =
    selection.workspaceId === workspaceId &&
    report.statuses.some((status) => status.key === selection.statusKey)
      ? selection.statusKey
      : "";
  const detailsRef = useRef<HTMLDivElement>(null);
  const selectDetails = (projectId: string, statusKey: string) =>
    setSelection({ workspaceId, projectId, statusKey });
  const taskProjectId = report.tasks.find(
    (entry) => entry.task.id === taskId,
  )?.projectId;

  return (
    <>
      <PageTitle title={t("tasks:reports.title")} hideAppName />
      <WorkspaceLayout
        title={t("tasks:reports.title")}
        headerActions={
          <Button
            variant="outline"
            size="sm"
            disabled={data.isFetching}
            onClick={data.refresh}
          >
            <RotateCcw className="size-3.5" />
            {t("tasks:reports.refresh")}
          </Button>
        }
      >
        <div className="h-full min-w-0 overflow-y-auto p-4 sm:p-6">
          <h1 className="text-xl font-semibold tracking-tight">
            {t("tasks:reports.title")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {t("tasks:reports.description")}
          </p>
          {data.isLoading ? (
            <p role="status" className="py-12 text-sm text-muted-foreground">
              {t("common:empty.loading")}
            </p>
          ) : data.hasError ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 py-8 text-sm text-destructive"
            >
              <p>{t("tasks:reports.loadError")}</p>
              <Button
                variant="outline"
                size="sm"
                disabled={data.isFetching}
                onClick={data.refresh}
              >
                {t("common:error.tryAgain")}
              </Button>
            </div>
          ) : data.projects.length === 0 ? (
            <p role="status" className="py-12 text-sm text-muted-foreground">
              {t("tasks:reports.noProjects")}
            </p>
          ) : (
            <>
              <dl className="my-6 grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-muted/15 py-4 text-center">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {t("tasks:reports.projects")}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums">
                    {report.projects.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {t("tasks:reports.total")}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums">
                    {report.total}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {t("tasks:reports.archived")}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums">
                    {report.archived}
                  </dd>
                </div>
              </dl>
              <WorkspaceReportTable
                report={report}
                onSelect={(projectId, statusKey) => {
                  selectDetails(projectId, statusKey);
                  detailsRef.current?.scrollIntoView({
                    block: "start",
                    behavior: "auto",
                  });
                }}
              />
              <div ref={detailsRef} className="mt-8">
                <WorkspaceReportDetails
                  key={`${workspaceId}:${projectId}:${statusKey}`}
                  report={report}
                  projectId={projectId}
                  statusKey={statusKey}
                  onSelect={selectDetails}
                  onOpenTask={(taskId) =>
                    void navigate({
                      to: "/dashboard/workspace/$workspaceId/reports",
                      params: { workspaceId },
                      search: { taskId },
                      replace: true,
                    })
                  }
                />
              </div>
            </>
          )}
          {taskProjectId && (
            <TaskDetailsSheet
              taskId={taskId}
              projectId={taskProjectId}
              workspaceId={workspaceId}
              onClose={() =>
                void navigate({
                  to: "/dashboard/workspace/$workspaceId/reports",
                  params: { workspaceId },
                  search: {},
                  replace: true,
                })
              }
            />
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}
