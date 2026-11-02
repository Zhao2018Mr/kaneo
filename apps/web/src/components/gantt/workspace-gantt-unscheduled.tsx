import { format, startOfDay } from "date-fns";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { parseTaskDate } from "./timeline";
import type { getWorkspaceUnscheduledTasks } from "./workspace-gantt";

type Props = {
  tasks: ReturnType<typeof getWorkspaceUnscheduledTasks>;
  isScheduling: boolean;
  onOpenTask: (id: string) => void;
  onScheduleTask: (id: string, date: Date) => Promise<boolean>;
  onDragEnd: () => void;
};

export function WorkspaceGanttUnscheduled({
  tasks,
  isScheduling,
  onOpenTask,
  onScheduleTask,
  onDragEnd,
}: Props) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState("");
  const [date, setDate] = useState(() =>
    format(startOfDay(new Date()), "yyyy-MM-dd"),
  );
  const taskId = tasks.some((task) => task.id === selectedId)
    ? selectedId
    : (tasks[0]?.id ?? "");
  const parsedDate = parseTaskDate(date);
  return (
    <section
      aria-label={t("tasks:gantt.unscheduledTitle")}
      aria-busy={isScheduling}
      className="shrink-0 border-b border-border bg-muted/15 px-3 py-3 sm:px-4"
    >
      <h2 className="text-xs font-semibold text-foreground">
        {t("tasks:gantt.unscheduledTitle")} ({tasks.length})
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("tasks:gantt.schedulingHint")}
      </p>
      <div className="mt-2 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            draggable={!isScheduling}
            disabled={isScheduling}
            onClick={() => onOpenTask(task.id)}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/kaneo-task-id", task.id);
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={onDragEnd}
            aria-label={t("tasks:gantt.dragUnscheduledTask", {
              title: task.title,
            })}
            className="flex min-h-11 w-56 max-w-full shrink-0 cursor-grab flex-col justify-center rounded-md border border-border bg-card px-2.5 py-1.5 text-left hover:bg-accent disabled:cursor-wait disabled:opacity-60 active:cursor-grabbing"
          >
            <span className="w-full truncate text-[10px] text-muted-foreground">
              {task.projectName} · {task.projectSlug}-{task.number}
            </span>
            <span className="w-full truncate text-xs font-medium">
              {task.title}
            </span>
            <span className="w-full truncate text-[10px] text-muted-foreground">
              {task.assigneeName || t("tasks:gantt.unassigned")}
            </span>
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (taskId && parsedDate && !isScheduling)
            void onScheduleTask(taskId, parsedDate);
        }}
      >
        <select
          aria-label={t("tasks:gantt.taskToSchedule")}
          value={taskId}
          disabled={isScheduling}
          onChange={(event) => setSelectedId(event.target.value)}
          className="h-9 min-w-0 max-w-full rounded-md border border-border bg-background px-2 text-sm sm:max-w-72"
        >
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.projectSlug}-{task.number} · {task.title}
            </option>
          ))}
        </select>
        <input
          type="date"
          required
          aria-label={t("tasks:gantt.scheduleDate")}
          value={date}
          min="0001-01-01"
          max="9999-12-31"
          disabled={isScheduling}
          onChange={(event) => setDate(event.target.value)}
          className="h-9 min-w-0 rounded-md border border-border bg-background px-2 text-base sm:text-sm"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isScheduling || !taskId || !parsedDate}
        >
          {t("tasks:gantt.scheduleTask")}
        </Button>
      </form>
    </section>
  );
}
