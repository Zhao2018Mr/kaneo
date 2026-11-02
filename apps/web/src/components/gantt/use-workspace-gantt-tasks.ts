import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { startOfDay } from "date-fns";
import getTasks from "@/fetchers/task/get-tasks";
import { useWorkspaceProjectBoards } from "@/hooks/queries/workspace/use-workspace-project-boards";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import {
  getWorkspaceGanttTasks,
  getWorkspaceGanttAssignees,
  getWorkspaceUnscheduledTasks,
  type WorkspaceGanttProject,
} from "./workspace-gantt";

/** 复用项目任务缓存和逐项目授权接口，汇总当前工作区可访问项目的排期。 */
export function useWorkspaceGanttTasks(
  workspaceId: string,
  selectedProjectId: string,
  assigneeFilter: string,
) {
  const queryClient = useQueryClient();
  const { mutateAsync: updateTask } = useUpdateTask();
  const boards = useWorkspaceProjectBoards(workspaceId);
  const { projects } = boards;
  const projectTasks = useMemo<WorkspaceGanttProject[]>(
    () =>
      boards.projectBoards.map(({ project, board }) => ({
        id: project.id,
        name: project.name,
        slug: project.slug,
        tasks: [
          ...(board?.columns.flatMap((column) => column.tasks) ?? []),
          ...(board?.plannedTasks ?? []),
        ],
      })),
    [boards.projectBoards],
  );
  const scheduledTasks = useMemo(
    () =>
      getWorkspaceGanttTasks(
        projectTasks,
        selectedProjectId || undefined,
        assigneeFilter || undefined,
      ),
    [projectTasks, selectedProjectId, assigneeFilter],
  );
  const unscheduledTasks = useMemo(
    () =>
      getWorkspaceUnscheduledTasks(
        projectTasks,
        selectedProjectId || undefined,
        assigneeFilter || undefined,
      ),
    [projectTasks, selectedProjectId, assigneeFilter],
  );
  const assignees = useMemo(
    () => getWorkspaceGanttAssignees(projectTasks),
    [projectTasks],
  );
  const groups = useMemo(() => {
    const tasksByProject = new Map<string, typeof scheduledTasks>();
    for (const task of scheduledTasks) {
      const tasks = tasksByProject.get(task.projectId) ?? [];
      tasks.push(task);
      tasksByProject.set(task.projectId, tasks);
    }
    return projects.flatMap((project) => {
      const tasks = tasksByProject.get(project.id);
      return tasks?.length ? [{ project, tasks }] : [];
    });
  }, [projects, scheduledTasks]);
  return {
    projects,
    projectTasks,
    scheduledTasks,
    unscheduledTasks,
    assignees,
    groups,
    isLoading: boards.isLoading,
    hasError: boards.hasError,
    retry: boards.refresh,
    scheduleTask: async (taskId: string, date: Date) => {
      const task = unscheduledTasks.find((item) => item.id === taskId);
      if (!task || Number.isNaN(date.getTime())) return false;
      const start = startOfDay(date);
      const dates = {
        startDate: start.toISOString(),
        dueDate: start.toISOString(),
      };
      await updateTask({
        ...task,
        ...dates,
      });
      // Show the confirmed schedule immediately while the normal invalidation refreshes the board.
      queryClient.setQueryData<Awaited<ReturnType<typeof getTasks>>>(
        ["tasks", task.projectId],
        (board) => {
          if (!board) return board;
          const updateDates = (item: (typeof board.plannedTasks)[number]) =>
            item.id === taskId ? { ...item, ...dates } : item;
          return {
            ...board,
            columns: board.columns.map((column) => ({
              ...column,
              tasks: column.tasks.map(updateDates),
            })),
            plannedTasks: board.plannedTasks.map(updateDates),
          };
        },
      );
      return true;
    },
  };
}
