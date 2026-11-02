import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addDays, isToday } from "date-fns";
import { RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { buildGanttTimeline } from "@/components/gantt/timeline";
import { useWorkspaceGanttTasks } from "@/components/gantt/use-workspace-gantt-tasks";
import { WorkspaceGanttChart } from "@/components/gantt/workspace-gantt-chart";
import { WorkspaceGanttControls } from "@/components/gantt/workspace-gantt-controls";
import { WorkspaceGanttSubscription } from "@/components/gantt/workspace-gantt-subscription";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { toast } from "@/lib/toast";

type GanttSearchParams = { taskId?: string };

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/gantt",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): GanttSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const [selection, setSelection] = useState({
    workspaceId,
    projectId: "",
    assigneeId: "",
  });
  const selectedAssigneeId =
    selection.workspaceId === workspaceId ? selection.assigneeId : "";
  const [isScheduling, setIsScheduling] = useState(false);
  const schedulingRef = useRef(false);
  const selectedProjectId =
    selection.workspaceId === workspaceId ? selection.projectId : "";
  const data = useWorkspaceGanttTasks(
    workspaceId,
    selectedProjectId,
    selectedAssigneeId,
  );
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const isMobile = useIsMobile();
  const [isTaskRailOpen, setIsTaskRailOpen] = useState(false);
  const showTaskRail = !isMobile || isTaskRailOpen;
  const [windowStart, setWindowStart] = useState<{
    workspaceId: string;
    date: Date;
  } | null>(null);
  const requestedStart =
    windowStart && windowStart.workspaceId === workspaceId
      ? windowStart.date
      : null;
  const showDate = (date: Date) => setWindowStart({ workspaceId, date });
  const todayCellRef = useRef<HTMLDivElement>(null);
  const timeline = useMemo(
    () =>
      buildGanttTimeline(
        [
          ...data.scheduledTasks,
          ...(data.unscheduledTasks.length > 0
            ? [
                {
                  scheduleStart: new Date(),
                  scheduleEnd: addDays(new Date(), 90),
                },
              ]
            : []),
        ],
        weekStartsOn,
        isMobile ? 3.125 : 2.75,
        requestedStart,
      ),
    [
      data.scheduledTasks,
      data.unscheduledTasks.length,
      weekStartsOn,
      isMobile,
      requestedStart,
    ],
  );
  const todayInRange = timeline?.days.some((day) => isToday(day)) ?? false;
  // Resolve against all loaded tasks so filtering does not change an open sheet's project.
  const taskProjectId = data.projectTasks.find((project) =>
    project.tasks.some((task) => task.id === taskId),
  )?.id;
  const scrollToToday = () => {
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    todayCellRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  };
  const openTask = (id: string) =>
    navigate({
      to: "/dashboard/workspace/$workspaceId/gantt",
      params: { workspaceId },
      search: { taskId: id },
      replace: true,
    });
  const scheduleTask = async (taskId: string, date: Date) => {
    if (schedulingRef.current) return false;
    schedulingRef.current = true;
    setIsScheduling(true);
    try {
      const saved = await data.scheduleTask(taskId, date);
      if (!saved) return false;
      toast.success(t("tasks:gantt.scheduledSuccess"));
      showDate(date);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:gantt.updateDatesError"),
      );
      return false;
    } finally {
      schedulingRef.current = false;
      setIsScheduling(false);
    }
  };

  return (
    <>
      <PageTitle title={t("tasks:gantt.workspaceTitle")} hideAppName />
      <WorkspaceLayout title={t("tasks:gantt.workspaceTitle")}>
        {data.projects.map((project) => (
          <WorkspaceGanttSubscription key={project.id} projectId={project.id} />
        ))}
        <div className="flex h-full min-h-0 flex-col bg-background">
          <h1 className="sr-only">{t("tasks:gantt.workspaceTitle")}</h1>
          <WorkspaceGanttControls
            projects={data.projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={(projectId) => {
              setSelection({
                workspaceId,
                projectId,
                assigneeId: selectedAssigneeId,
              });
              setWindowStart(null);
            }}
            assignees={data.assignees}
            selectedAssigneeId={selectedAssigneeId}
            onSelectAssignee={(assigneeId) => {
              setSelection({
                workspaceId,
                projectId: selectedProjectId,
                assigneeId,
              });
              setWindowStart(null);
            }}
            timeline={timeline}
            onShowDate={showDate}
            onToday={scrollToToday}
            todayInRange={todayInRange}
            showTaskRail={showTaskRail}
            onToggleTaskRail={() => setIsTaskRailOpen((value) => !value)}
            count={data.scheduledTasks.length}
            unscheduledCount={data.unscheduledTasks.length}
          />
          {data.isLoading ? (
            <div
              className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
              role="status"
            >
              {t("common:empty.loading")}
            </div>
          ) : data.hasError ? (
            <div
              className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-destructive"
              role="alert"
            >
              <p>{t("tasks:gantt.loadError")}</p>
              <Button variant="outline" size="sm" onClick={data.retry}>
                <RotateCcw className="size-3.5" />
                {t("common:error.tryAgain")}
              </Button>
            </div>
          ) : !timeline ? (
            <div className="flex flex-1 items-center justify-center px-6">
              <div className="max-w-sm text-center">
                <h2 className="text-sm font-semibold text-foreground">
                  {t("tasks:gantt.noTasks")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("tasks:gantt.noTasksSubtitle")}
                </p>
              </div>
            </div>
          ) : (
            <WorkspaceGanttChart
              groups={data.groups}
              unscheduledTasks={data.unscheduledTasks}
              timeline={timeline}
              isMobile={isMobile}
              showTaskRail={showTaskRail}
              todayCellRef={todayCellRef}
              onOpenTask={openTask}
              onShowDate={showDate}
              isScheduling={isScheduling}
              onScheduleTask={scheduleTask}
            />
          )}
          {taskProjectId && (
            <TaskDetailsSheet
              taskId={taskId}
              projectId={taskProjectId}
              workspaceId={workspaceId}
              onClose={() =>
                navigate({
                  to: "/dashboard/workspace/$workspaceId/gantt",
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
