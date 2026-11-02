import { format, isSameMonth, isToday, isWeekend } from "date-fns";
import { useLayoutEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { buildGanttTimeline } from "./timeline";
import type {
  getWorkspaceGanttTasks,
  getWorkspaceUnscheduledTasks,
} from "./workspace-gantt";
import { WorkspaceGanttUnscheduled } from "./workspace-gantt-unscheduled";
import { WorkspaceGanttProjectGroup } from "./workspace-gantt-project-group";

type Props = {
  groups: {
    project: { id: string; name: string; slug: string };
    tasks: ReturnType<typeof getWorkspaceGanttTasks>;
  }[];
  unscheduledTasks: ReturnType<typeof getWorkspaceUnscheduledTasks>;
  timeline: NonNullable<ReturnType<typeof buildGanttTimeline>>;
  isMobile: boolean;
  showTaskRail: boolean;
  todayCellRef: RefObject<HTMLDivElement | null>;
  onOpenTask: (id: string) => void;
  onShowDate: (date: Date) => void;
  isScheduling: boolean;
  onScheduleTask: (taskId: string, date: Date) => Promise<boolean>;
};

export function WorkspaceGanttChart({
  groups,
  unscheduledTasks,
  timeline,
  isMobile,
  showTaskRail,
  todayCellRef,
  onOpenTask,
  onShowDate,
  onScheduleTask,
  isScheduling,
}: Props) {
  const { t } = useTranslation();
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const [pixelsPerDay, setPixelsPerDay] = useState(44);
  const [dropDay, setDropDay] = useState<number | null>(null);
  const railWidthRem = showTaskRail ? (isMobile ? 12 : 16) : 0;
  useLayoutEffect(() => {
    const element = timelineTrackRef.current;
    if (!element) return;
    const update = () =>
      setPixelsPerDay(element.clientWidth / timeline.days.length);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [timeline]);
  const dropTask = (event: DragEvent, day: Date) => {
    if (
      isScheduling ||
      !event.dataTransfer.types.includes("text/kaneo-task-id")
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    setDropDay(null);
    const taskId = event.dataTransfer.getData("text/kaneo-task-id");
    if (unscheduledTasks.some((task) => task.id === taskId))
      void onScheduleTask(taskId, day);
  };
  const allowDrop = (event: DragEvent, index: number) => {
    if (
      isScheduling ||
      !event.dataTransfer.types.includes("text/kaneo-task-id")
    )
      return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropDay(index);
  };
  return (
    <>
      {unscheduledTasks.length > 0 && (
        <WorkspaceGanttUnscheduled
          tasks={unscheduledTasks}
          isScheduling={isScheduling}
          onOpenTask={onOpenTask}
          onScheduleTask={onScheduleTask}
          onDragEnd={() => setDropDay(null)}
        />
      )}
      <div
        data-testid="workspace-gantt-scroll-container"
        className="min-h-0 flex-1 overflow-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
        style={{ scrollPaddingLeft: `${railWidthRem}rem` }}
      >
        <div className="relative min-w-max touch-pan-x touch-pan-y">
          <div className="sticky top-0 z-20 flex border-b border-border bg-background/95 backdrop-blur">
            {showTaskRail && (
              <div
                className="sticky left-0 z-30 shrink-0 border-r border-border bg-background px-3 py-3"
                style={{ width: `${railWidthRem}rem` }}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("tasks:gantt.projectAndTask")}
                </p>
              </div>
            )}
            <div
              className="grid shrink-0"
              style={{
                gridTemplateColumns: timeline.gridTemplateColumns,
                minWidth: `${timeline.timelineMinWidthRem}rem`,
              }}
            >
              {timeline.days.map((day, index) => {
                const showMonth =
                  index === 0 ||
                  !isSameMonth(day, timeline.days[index - 1] ?? day);
                const currentDay = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    ref={currentDay ? todayCellRef : undefined}
                    aria-label={format(day, "yyyy-MM-dd")}
                    className={cn(
                      "border-r border-border/70 px-0.5 py-2 text-center sm:px-1",
                      isWeekend(day) && "bg-muted/25",
                      dropDay === index && "bg-primary/15",
                    )}
                    onDragOver={(event) => allowDrop(event, index)}
                    onDragLeave={() => setDropDay(null)}
                    onDrop={(event) => dropTask(event, day)}
                  >
                    <div className="h-4 text-[10px] font-medium text-muted-foreground">
                      {showMonth ? format(day, "MMM") : ""}
                    </div>
                    <div
                      className={cn(
                        "mx-auto flex size-6 items-center justify-center rounded-full text-xs font-medium",
                        currentDay && "bg-primary text-primary-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div
            className="relative min-h-40"
            onDragOver={(event) => {
              const rect = timelineTrackRef.current?.getBoundingClientRect();
              if (
                !rect ||
                event.clientX < rect.left ||
                event.clientX >= rect.right
              )
                return;
              const index = Math.floor(
                (event.clientX - rect.left) / pixelsPerDay,
              );
              if (timeline.days[index]) allowDrop(event, index);
            }}
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setDropDay(null);
            }}
            onDrop={(event) => {
              const rect = timelineTrackRef.current?.getBoundingClientRect();
              if (
                !rect ||
                event.clientX < rect.left ||
                event.clientX >= rect.right
              )
                return;
              const day =
                timeline.days[
                  Math.floor((event.clientX - rect.left) / pixelsPerDay)
                ];
              if (day) dropTask(event, day);
            }}
          >
            <div
              ref={timelineTrackRef}
              className="absolute inset-y-0 z-0 grid"
              style={{
                left: `${railWidthRem}rem`,
                gridTemplateColumns: timeline.gridTemplateColumns,
                width: `${timeline.timelineMinWidthRem}rem`,
              }}
            >
              {timeline.days.map((day, index) => (
                <div
                  key={`bg-line-${day.toISOString()}`}
                  className={cn(
                    "h-full border-r border-border/60",
                    isWeekend(day) && "bg-muted/25",
                    dropDay === index && "bg-primary/15",
                  )}
                />
              ))}
            </div>
            <div className="relative z-10 flex flex-col">
              {groups.map(({ project, tasks }) => (
                <WorkspaceGanttProjectGroup
                  key={project.id}
                  project={project}
                  tasks={tasks}
                  timeline={timeline}
                  pixelsPerDay={pixelsPerDay}
                  isMobile={isMobile}
                  showTaskRail={showTaskRail}
                  onOpenTask={onOpenTask}
                  onShowDate={onShowDate}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
