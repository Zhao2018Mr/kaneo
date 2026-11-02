import { addDays, format } from "date-fns";
import { useTranslation } from "react-i18next";
import { getStatusLabel } from "@/lib/i18n/domain";
import { GanttTaskBar } from "./gantt-task-bar";
import type { buildGanttTimeline } from "./timeline";
import type { getWorkspaceGanttTasks } from "./workspace-gantt";

type Props = {
  project: { id: string; name: string; slug: string };
  tasks: ReturnType<typeof getWorkspaceGanttTasks>;
  timeline: NonNullable<ReturnType<typeof buildGanttTimeline>>;
  pixelsPerDay: number;
  isMobile: boolean;
  showTaskRail: boolean;
  onOpenTask: (id: string) => void;
  onShowDate: (date: Date) => void;
};

export function WorkspaceGanttProjectGroup({
  project,
  tasks,
  timeline,
  pixelsPerDay,
  isMobile,
  showTaskRail,
  onOpenTask,
  onShowDate,
}: Props) {
  const { t } = useTranslation();
  if (tasks.length === 0) return null;
  return (
    <section aria-label={project.name}>
      <div className="border-b border-border bg-muted/70 text-xs font-semibold text-foreground">
        <h2 className="sticky left-0 w-48 truncate px-3 py-2 sm:w-64">
          {project.name}
        </h2>
      </div>
      {tasks.map((task) => (
        <div
          key={task.id}
          data-task-id={task.id}
          className="grid items-stretch border-b border-border/70"
          style={{
            gridTemplateColumns: showTaskRail
              ? `${isMobile ? 12 : 16}rem max-content`
              : "max-content",
          }}
        >
          {showTaskRail && (
            <div className="sticky left-0 z-[11] h-full border-r border-border bg-background">
              <button
                type="button"
                className="flex min-h-[44px] w-full min-w-0 flex-col items-start justify-center gap-0.5 px-3 py-1.5 text-left transition-colors hover:bg-muted"
                onClick={() => onOpenTask(task.id)}
              >
                <div className="flex w-full items-center gap-1.5">
                  <span className="max-w-28 truncate rounded-full bg-secondary px-1.5 py-px text-[10px] font-medium text-secondary-foreground">
                    {getStatusLabel(task.status)}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {project.slug}-{task.number}
                  </span>
                </div>
                <p className="w-full line-clamp-1 text-xs font-medium leading-tight text-foreground">
                  {task.title}
                </p>
                <p className="w-full truncate text-[11px] leading-tight text-muted-foreground">
                  {format(task.scheduleStart, "MMM d, yyyy")} -{" "}
                  {format(task.scheduleEnd, "MMM d, yyyy")}
                  {task.assigneeName ? ` • ${task.assigneeName}` : ""}
                </p>
              </button>
              {(task.scheduleEnd < timeline.rangeStart ||
                task.scheduleStart > timeline.rangeEnd) && (
                <button
                  type="button"
                  className="px-3 pb-2 text-xs text-primary underline"
                  onClick={() => onShowDate(addDays(task.scheduleStart, -7))}
                >
                  {t("tasks:gantt.showTaskDates")}
                </button>
              )}
            </div>
          )}
          <div
            className="relative min-h-11 shrink-0 select-none"
            style={{ minWidth: `${timeline.timelineMinWidthRem}rem` }}
          >
            <GanttTaskBar
              task={task}
              timeline={timeline}
              pixelsPerDay={pixelsPerDay}
              isMobile={isMobile}
              onOpenTask={() => onOpenTask(task.id)}
            />
          </div>
        </div>
      ))}
    </section>
  );
}
