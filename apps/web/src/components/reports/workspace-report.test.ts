import { describe, expect, it } from "vite-plus/test";
import type Task from "@/types/task";
import { buildWorkspaceReport, type ReportBoard } from "./workspace-report";

function task(id: string, status: string): Task {
  return {
    id,
    status,
    title: id,
    number: 1,
    projectId: "alpha",
    description: null,
    priority: null,
    startDate: null,
    dueDate: null,
    position: 0,
    createdAt: "2026-11-01",
    userId: null,
    assigneeId: null,
    assigneeName: null,
  };
}
const label = (status: string, name?: string) => name || status;
const alpha: ReportBoard = {
  id: "alpha",
  name: "Alpha",
  slug: "ALP",
  columns: [
    { id: "todo-a", name: "待做", tasks: [task("one", "todo-a")] },
    { id: "paused-a", name: "暂停", tasks: [task("two", "paused-a")] },
    { id: "acceptance", name: "等待验收", tasks: [] },
  ],
  plannedTasks: [task("three", "planned")],
  archivedTasks: [task("four", "archived")],
};

describe("workspace project report", () => {
  it("counts workflow, planned and archived tasks once and keeps empty projects", () => {
    const report = buildWorkspaceReport(
      [
        alpha,
        {
          id: "empty",
          name: "Empty",
          slug: "EMP",
          columns: [],
          plannedTasks: [],
          archivedTasks: [],
        },
      ],
      label,
    );
    expect(report.total).toBe(4);
    expect(report.archived).toBe(1);
    expect(report.projects.map((p) => p.total)).toEqual([4, 0]);
    expect(report.tasks.map((entry) => entry.task.id)).toEqual([
      "one",
      "two",
      "three",
      "four",
    ]);
    expect(report.statuses.map((s) => s.label)).toContain("等待验收");
    expect(report.projects[0].counts.get("archived")).toBe(1);
  });

  it("merges identically named custom statuses across projects with different slugs", () => {
    const report = buildWorkspaceReport(
      [
        alpha,
        {
          id: "beta",
          name: "Beta",
          slug: "BET",
          columns: [
            { id: "hold", name: "暂停", tasks: [task("five", "hold")] },
          ],
          plannedTasks: [],
          archivedTasks: [],
        },
      ],
      label,
    );
    const paused = report.statuses.filter((s) => s.label === "暂停");
    expect(paused).toHaveLength(1);
    expect(report.counts.get(paused[0].key)).toBe(2);
    expect(
      report.tasks
        .filter((entry) => entry.statusKey === paused[0].key)
        .map((entry) => entry.projectId),
    ).toEqual(["alpha", "beta"]);
  });

  it("deduplicates repeated task rows before calculating totals", () => {
    const report = buildWorkspaceReport(
      [
        {
          ...alpha,
          columns: [
            ...alpha.columns,
            { id: "duplicate", name: "重复", tasks: [task("one", "todo-a")] },
          ],
        },
      ],
      label,
    );
    expect(report.total).toBe(4);
    expect(
      [...report.counts.values()].reduce((sum, count) => sum + count, 0),
    ).toBe(4);
    expect(
      [...report.projects[0].counts.values()].reduce(
        (sum, count) => sum + count,
        0,
      ),
    ).toBe(4);
  });
});
