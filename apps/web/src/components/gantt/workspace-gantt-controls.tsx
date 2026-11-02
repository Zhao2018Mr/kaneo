import { addDays, format } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  GANTT_WINDOW_DAYS,
  parseTaskDate,
  type buildGanttTimeline,
} from "./timeline";

type Props = {
  projects: { id: string; name: string }[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  assignees: { id: string; name: string }[];
  selectedAssigneeId: string;
  onSelectAssignee: (id: string) => void;
  timeline: ReturnType<typeof buildGanttTimeline>;
  onShowDate: (date: Date) => void;
  onToday: () => void;
  todayInRange: boolean;
  showTaskRail: boolean;
  onToggleTaskRail: () => void;
  count: number;
  unscheduledCount: number;
};

export function WorkspaceGanttControls({
  projects,
  selectedProjectId,
  onSelectProject,
  assignees,
  selectedAssigneeId,
  onSelectAssignee,
  timeline,
  onShowDate,
  onToday,
  todayInRange,
  showTaskRail,
  onToggleTaskRail,
  count,
  unscheduledCount,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/80 px-3 py-2 sm:px-4">
      <label className="sr-only" htmlFor="workspace-gantt-project">
        {t("tasks:gantt.projectFilter")}
      </label>
      <select
        id="workspace-gantt-project"
        className="h-9 min-w-0 max-w-56 rounded-md border border-border bg-background px-2 text-sm"
        value={selectedProjectId}
        onChange={(event) => onSelectProject(event.target.value)}
      >
        <option value="">{t("tasks:gantt.allProjects")}</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="workspace-gantt-assignee">
        {t("tasks:gantt.assigneeFilter")}
      </label>
      <select
        id="workspace-gantt-assignee"
        className="h-9 min-w-0 max-w-56 rounded-md border border-border bg-background px-2 text-sm"
        value={selectedAssigneeId}
        onChange={(event) => onSelectAssignee(event.target.value)}
      >
        <option value="">{t("tasks:gantt.allAssignees")}</option>
        {assignees.map((assignee) => (
          <option key={assignee.id} value={assignee.id}>
            {assignee.name || t("tasks:gantt.unassigned")}
          </option>
        ))}
      </select>
      {timeline && (
        <>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("tasks:gantt.previousPeriod")}
            disabled={!timeline.hasPrevious}
            onClick={() =>
              onShowDate(addDays(timeline.rangeStart, -GANTT_WINDOW_DAYS))
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <input
            type="date"
            aria-label={t("tasks:gantt.periodStart")}
            className="h-9 min-w-0 rounded-md border border-border bg-background px-2 text-base sm:h-8 sm:text-sm"
            min={format(timeline.minimumStart, "yyyy-MM-dd")}
            max={format(timeline.maximumStart, "yyyy-MM-dd")}
            value={format(timeline.rangeStart, "yyyy-MM-dd")}
            onChange={(event) => {
              const date = parseTaskDate(event.target.value);
              if (date) onShowDate(date);
            }}
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            – {format(timeline.rangeEnd, "MMM d, yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("tasks:gantt.nextPeriod")}
            disabled={!timeline.hasNext}
            onClick={() =>
              onShowDate(addDays(timeline.rangeStart, GANTT_WINDOW_DAYS))
            }
          >
            <ChevronRight className="size-4" />
          </Button>
        </>
      )}
      <Button
        variant="outline"
        size="xs"
        className="h-9 touch-manipulation sm:h-auto"
        aria-label={t("tasks:gantt.jumpToToday")}
        onClick={onToday}
        disabled={!todayInRange}
      >
        <Calendar className="size-3.5" />
        <span className="hidden sm:inline">{t("tasks:gantt.jumpToToday")}</span>
      </Button>
      <Button
        variant="outline"
        size="xs"
        className="h-9 touch-manipulation sm:hidden"
        aria-pressed={showTaskRail}
        onClick={onToggleTaskRail}
      >
        {showTaskRail ? (
          <ChevronLeft className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        {showTaskRail ? t("tasks:gantt.hideTasks") : t("tasks:gantt.showTasks")}
      </Button>
      <span className="ml-auto text-xs text-muted-foreground">
        {t("tasks:gantt.scheduledCount", { count })}
        {unscheduledCount > 0 &&
          ` · ${t("tasks:gantt.unscheduledCount", { count: unscheduledCount })}`}
      </span>
    </div>
  );
}
