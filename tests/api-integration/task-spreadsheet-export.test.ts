// Verifies complete, project-scoped exports independently of board pagination.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

describe("API integration: spreadsheet task export", () => {
  beforeEach(resetTestDatabase);

  it("exports all tasks, full descriptions, field definitions and raw values without mutating them", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    await db
      .update(schema.columnTable)
      .set({ name: "待开发" })
      .where(eq(schema.columnTable.id, columns.todo.id));
    const tasks = await db
      .insert(schema.taskTable)
      .values(
        Array.from({ length: 125 }, (_, i) => ({
          projectId: project.id,
          number: i + 1,
          title: i === 0 ? "=1+1" : `Task ${i}`,
          status: i === 1 ? "archived" : i === 2 ? "planned" : "to-do",
          description: i === 0 ? "需求说明".repeat(20_000) : null,
          userId: owner.user.id,
        })),
      )
      .returning();
    const [field] = await db
      .insert(schema.customFieldDefinitionTable)
      .values({
        projectId: project.id,
        name: "开发工时（小时）",
        type: "number",
        required: false,
      })
      .returning();
    await db
      .insert(schema.customFieldValueTable)
      .values({ taskId: tasks[0].id, fieldId: field.id, value: "1.25" });
    await db.insert(schema.labelTable).values({
      workspaceId: owner.workspace.id,
      taskId: tasks[0].id,
      name: "需求",
      color: "#123456",
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/task/export/${project.id}/spreadsheet`,
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.tasks).toHaveLength(125);
    expect(data.tasks.find((t) => t.id === tasks[0].id)).toMatchObject({
      title: "=1+1",
      description: "需求说明".repeat(20_000),
      assigneeName: owner.user.name,
      labels: ["需求"],
      customFieldValues: { [field.id]: "1.25" },
    });
    expect(data.tasks.find((t) => t.id === tasks[1].id).status).toBe(
      "archived",
    );
    expect(data.tasks.find((t) => t.id === tasks[2].id).status).toBe("planned");
    expect(data.fields).toHaveLength(1);
    expect(data.columns.find((c) => c.slug === "to-do").name).toBe("待开发");
    expect(
      await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.projectId, project.id)),
    ).toEqual(tasks);
  });

  it("handles an empty project and keeps the JSON export contract unchanged", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/task/export/${project.id}/spreadsheet`,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).tasks).toEqual([]);
    const old = await app.request(`/api/task/export/${project.id}`);
    expect(old.status).toBe(200);
    expect(Object.keys(await old.json()).sort()).toEqual(["project", "tasks"]);
  });

  it.each(["createdAt", "updatedAt", "startDate", "dueDate"] as const)(
    "filters by %s with inclusive start and exclusive next-day end",
    async (dateField) => {
      const owner = await createWorkspaceMember({ role: "owner" });
      const { project } = await createProjectFixture({
        workspaceId: owner.workspace.id,
      });
      const from = "2026-10-14T16:00:00.000Z",
        until = "2026-10-15T16:00:00.000Z";
      await db.insert(schema.taskTable).values([
        {
          projectId: project.id,
          title: "before",
          number: 1,
          [dateField]: new Date(Date.parse(from) - 1),
        },
        {
          projectId: project.id,
          title: "first",
          number: 2,
          [dateField]: new Date(from),
        },
        {
          projectId: project.id,
          title: "last",
          number: 3,
          [dateField]: new Date(Date.parse(until) - 1),
        },
        {
          projectId: project.id,
          title: "after",
          number: 4,
          [dateField]: new Date(until),
        },
        ...(["startDate", "dueDate"].includes(dateField)
          ? [
              {
                projectId: project.id,
                number: 5,
                title: "no date",
                [dateField]: null,
              },
            ]
          : []),
      ]);
      mockAuthenticatedSession(owner.user);
      const { app } = createApp();
      const range = { dateField, from, until };
      const response = await app.request(
        `/api/task/export/${project.id}/spreadsheet?${new URLSearchParams(range)}`,
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.tasks.map((task) => task.title).sort()).toEqual([
        "first",
        "last",
      ]);
      expect(data.range).toEqual(range);
      const emptyRange = {
        dateField,
        from: "2100-01-01T00:00:00Z",
        until: "2100-01-02T00:00:00Z",
      };
      const empty = await app.request(
        `/api/task/export/${project.id}/spreadsheet?${new URLSearchParams(emptyRange)}`,
      );
      expect(empty.status).toBe(200);
      expect((await empty.json()).tasks).toEqual([]);
      expect(
        (
          await app.request(
            `/api/task/export/${project.id}/spreadsheet?dateField=createdAt`,
          )
        ).status,
      ).toBe(400);
      const all = await (
        await app.request(`/api/task/export/${project.id}/spreadsheet`)
      ).json();
      expect(all.tasks).toHaveLength(
        ["startDate", "dueDate"].includes(dateField) ? 5 : 4,
      );
    },
  );

  it("denies anonymous, cross-workspace and restricted-project requests", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const { app } = createApp();
    mockAnonymousSession();
    expect(
      (await app.request(`/api/task/export/${project.id}/spreadsheet`)).status,
    ).toBe(401);
    const outsider = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(outsider.user);
    expect([403, 404]).toContain(
      (await app.request(`/api/task/export/${project.id}/spreadsheet`)).status,
    );
    const member = await createWorkspaceMember({ role: "admin" });
    const hidden = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await restrictToProjects(member.workspace.id, member.user.id, []);
    mockAuthenticatedSession(member.user);
    expect(
      (await app.request(`/api/task/export/${hidden.project.id}/spreadsheet`))
        .status,
    ).toBe(403);
  });
});
