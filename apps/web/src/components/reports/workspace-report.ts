import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

/** 报表只读取当前工作区已授权项目的完整看板快照。 */
export type ReportBoard = Pick<
  ProjectWithTasks,
  "id" | "name" | "slug" | "plannedTasks" | "archivedTasks"
> & {
  columns: { id: string; name: string; tasks: Task[] }[];
};

export type ReportTask = {
  task: Task;
  projectId: string;
  projectName: string;
  projectSlug: string;
  statusKey: string;
  statusLabel: string;
};

/**
 * 按真实工作流汇总需求；同名状态跨项目合并，空项目和零任务状态也保留。
 * 每条任务只计一次，待规划和已归档任务属于独立状态，计入需求总数。
 * getLabel 负责默认状态的本地化以及项目自定义列名的展示。
 */
export function buildWorkspaceReport(
  boards: ReportBoard[],
  getLabel: (status: string, columnName?: string) => string,
) {
  const statuses = new Map<string, { key: string; label: string }>();
  const counts = new Map<string, number>();
  const tasks: ReportTask[] = [];
  const statusFor = (status: string, name?: string) => {
    const label = getLabel(status, name).trim();
    const key =
      status === "planned" || status === "archived"
        ? status
        : `workflow:${label}`;
    const descriptor = { key, label };
    statuses.set(key, descriptor);
    return descriptor;
  };
  const projects = boards.map((board) => {
    const columns = new Map(board.columns.map((column) => [column.id, column]));
    for (const column of board.columns) statusFor(column.id, column.name);
    const uniqueTasks = new Map<string, { task: Task; status: string }>();
    for (const task of board.columns.flatMap((column) => column.tasks)) {
      uniqueTasks.set(task.id, { task, status: task.status });
    }
    for (const task of board.plannedTasks)
      uniqueTasks.set(task.id, { task, status: "planned" });
    for (const task of board.archivedTasks)
      uniqueTasks.set(task.id, { task, status: "archived" });
    const projectCounts = new Map<string, number>();
    for (const { task, status } of uniqueTasks.values()) {
      const descriptor = statusFor(status, columns.get(status)?.name);
      projectCounts.set(
        descriptor.key,
        (projectCounts.get(descriptor.key) ?? 0) + 1,
      );
      counts.set(descriptor.key, (counts.get(descriptor.key) ?? 0) + 1);
      tasks.push({
        task,
        projectId: board.id,
        projectName: board.name,
        projectSlug: board.slug,
        statusKey: descriptor.key,
        statusLabel: descriptor.label,
      });
    }
    return {
      id: board.id,
      name: board.name,
      total: uniqueTasks.size,
      counts: projectCounts,
    };
  });
  // Keep reserved lifecycle states at the end, regardless of the first project's contents.
  statuses.delete("planned");
  statuses.delete("archived");
  statusFor("planned");
  statusFor("archived");
  return {
    projects,
    statuses: [...statuses.values()],
    counts,
    tasks,
    total: tasks.length,
    archived: counts.get("archived") ?? 0,
  };
}
