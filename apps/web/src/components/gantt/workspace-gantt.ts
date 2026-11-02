import type Task from "@/types/task";
import { parseTaskDate } from "./timeline";

export const UNASSIGNED_FILTER = "__unassigned__";

export type WorkspaceGanttProject = {
  id: string;
  name: string;
  slug: string;
  tasks: Task[];
};

type WorkspaceTask = Task & {
  projectName: string;
  projectSlug: string;
};

function matchesAssignee(task: Task, assigneeFilter?: string) {
  if (!assigneeFilter) return true;
  if (assigneeFilter === UNASSIGNED_FILTER) return !task.assigneeId;
  return task.assigneeId === assigneeFilter;
}

/**
 * 将工作区内各项目的任务整理成甘特图行，并丢弃没有任何排期日期的任务。
 *
 * 项目任务仍通过各项目现有接口加载；这里仅负责跨项目视图的筛选、日期
 * 归一化和排序，避免新增绕过项目权限边界的聚合接口。
 */
export function getWorkspaceGanttTasks(
  projects: WorkspaceGanttProject[],
  selectedProjectId?: string,
  assigneeFilter?: string,
) {
  return projects
    .filter((project) => !selectedProjectId || project.id === selectedProjectId)
    .flatMap((project) =>
      project.tasks.flatMap((task) => {
        if (!matchesAssignee(task, assigneeFilter)) return [];
        const parsedStart =
          parseTaskDate(task.startDate) ?? parseTaskDate(task.dueDate);
        const parsedEnd =
          parseTaskDate(task.dueDate) ?? parseTaskDate(task.startDate);

        if (!parsedStart || !parsedEnd) return [];

        return [
          {
            ...task,
            projectName: project.name,
            projectSlug: project.slug,
            scheduleStart: parsedStart <= parsedEnd ? parsedStart : parsedEnd,
            scheduleEnd: parsedEnd >= parsedStart ? parsedEnd : parsedStart,
          },
        ];
      }),
    )
    .sort(
      (left, right) =>
        left.scheduleStart.getTime() - right.scheduleStart.getTime() ||
        left.projectName.localeCompare(right.projectName),
    );
}

/** 返回尚无开始或截止日期的任务，供工作区甘特图排期。 */
export function getWorkspaceUnscheduledTasks(
  projects: WorkspaceGanttProject[],
  selectedProjectId?: string,
  assigneeFilter?: string,
): WorkspaceTask[] {
  return projects
    .filter((project) => !selectedProjectId || project.id === selectedProjectId)
    .flatMap((project) =>
      project.tasks
        .filter(
          (task) =>
            !parseTaskDate(task.startDate) &&
            !parseTaskDate(task.dueDate) &&
            matchesAssignee(task, assigneeFilter),
        )
        .map((task) => ({
          ...task,
          projectName: project.name,
          projectSlug: project.slug,
        })),
    );
}

/** 列出去重后的负责人，并在存在未分配任务时加入对应筛选项。 */
export function getWorkspaceGanttAssignees(projects: WorkspaceGanttProject[]) {
  const assignees = new Map<string, string>();
  let hasUnassigned = false;
  for (const project of projects) {
    for (const task of project.tasks) {
      if (!task.assigneeId) {
        hasUnassigned = true;
      } else {
        assignees.set(task.assigneeId, task.assigneeName || task.assigneeId);
      }
    }
  }
  return [
    ...[...assignees]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    ...(hasUnassigned ? [{ id: UNASSIGNED_FILTER, name: "" }] : []),
  ];
}
