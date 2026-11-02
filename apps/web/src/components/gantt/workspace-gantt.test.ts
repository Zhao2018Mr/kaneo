import { describe, expect, it } from "vite-plus/test";
import {
  getWorkspaceGanttAssignees,
  getWorkspaceGanttTasks,
  getWorkspaceUnscheduledTasks,
} from "./workspace-gantt";

const task = (
  id: string,
  startDate: string | null,
  dueDate: string | null,
  assigneeId: string | null = null,
  assigneeName: string | null = null,
) =>
  ({
    id,
    title: id,
    startDate,
    dueDate,
    assigneeId,
    assigneeName,
  }) as never;

describe("workspace Gantt task selection", () => {
  const projects = [
    {
      id: "one",
      name: "Alpha",
      slug: "ALP",
      tasks: [
        task("later", "2026-05-02", null, "user-1", "Alex"),
        task("unscheduled", null, null),
      ],
    },
    {
      id: "two",
      name: "Beta",
      slug: "BET",
      tasks: [task("earlier", null, "2026-04-01", "user-2", "Sam")],
    },
  ];

  it("includes only scheduled tasks across all projects in date order", () => {
    expect(getWorkspaceGanttTasks(projects).map(({ id }) => id)).toEqual([
      "earlier",
      "later",
    ]);
  });

  it("limits results to a selected project", () => {
    expect(getWorkspaceGanttTasks(projects, "one").map(({ id }) => id)).toEqual(
      ["later"],
    );
  });

  it("filters scheduled and unscheduled tasks by the same assignee", () => {
    expect(
      getWorkspaceGanttTasks(projects, undefined, "user-1").map(({ id }) => id),
    ).toEqual(["later"]);
    expect(
      getWorkspaceUnscheduledTasks(projects, undefined, "user-1"),
    ).toHaveLength(0);
  });

  it("keeps undated tasks grouped with project context for scheduling", () => {
    const unscheduled = getWorkspaceUnscheduledTasks(projects);
    expect(
      unscheduled.map(({ id, projectName, projectSlug }) => ({
        id,
        projectName,
        projectSlug,
      })),
    ).toEqual([
      { id: "unscheduled", projectName: "Alpha", projectSlug: "ALP" },
    ]);
  });

  it("offers each assigned person once and includes an unassigned filter option", () => {
    expect(getWorkspaceGanttAssignees(projects)).toEqual([
      { id: "user-1", name: "Alex" },
      { id: "user-2", name: "Sam" },
      { id: "__unassigned__", name: "" },
    ]);
  });
});
