// Exercises configuration copying against PostgreSQL without touching task contents.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

async function fixture(role = "owner") {
  const owner = await createWorkspaceMember({ role });
  const source = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  const target = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  await db
    .update(schema.columnTable)
    .set({ name: "待开发", color: "#64748b" })
    .where(eq(schema.columnTable.id, source.columns.todo.id));
  await db.insert(schema.customFieldDefinitionTable).values({
    projectId: source.project.id,
    name: "任务类型",
    type: "dropdown",
    options: ["功能需求", "缺陷"],
    required: true,
    defaultValue: "功能需求",
    position: 1,
  });
  mockAuthenticatedSession(owner.user);
  const { app } = createApp();
  const copy = (body: Record<string, unknown> = {}) =>
    app.request(`/api/project/${target.project.id}/copy-configuration`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceProjectId: source.project.id,
        workflow: true,
        customFields: true,
        ...body,
      }),
    });
  return { owner, source, target, copy };
}

describe("API integration: copy project configuration", () => {
  beforeEach(resetTestDatabase);

  it("copies ordered columns and field settings with fresh IDs, leaving the source intact", async () => {
    const { source, target, copy } = await fixture();
    const response = await copy();
    expect(response.status).toBe(200);
    const columns = await db
      .select()
      .from(schema.columnTable)
      .where(eq(schema.columnTable.projectId, target.project.id));
    expect(columns).toHaveLength(4);
    expect(columns.find((c) => c.slug === "to-do")).toMatchObject({
      name: "待开发",
      color: "#64748b",
    });
    expect(columns.map((c) => c.id)).not.toContain(source.columns.todo.id);
    const fields = await db
      .select()
      .from(schema.customFieldDefinitionTable)
      .where(
        eq(schema.customFieldDefinitionTable.projectId, target.project.id),
      );
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      name: "任务类型",
      type: "dropdown",
      required: true,
      defaultValue: "功能需求",
      options: ["功能需求", "缺陷"],
    });
    const sourceColumns = await db
      .select()
      .from(schema.columnTable)
      .where(eq(schema.columnTable.projectId, source.project.id));
    expect(sourceColumns.map((c) => c.id)).toContain(source.columns.todo.id);
    expect(await db.select().from(schema.taskTable)).toHaveLength(0);
  });

  it("rejects workflow replacement when even an archived task exists", async () => {
    const { target, copy } = await fixture();
    await db.insert(schema.taskTable).values({
      projectId: target.project.id,
      title: "Retain me",
      status: "archived",
      number: 1,
    });
    expect((await copy()).status).toBe(409);
    expect(
      await db
        .select()
        .from(schema.customFieldDefinitionTable)
        .where(
          eq(schema.customFieldDefinitionTable.projectId, target.project.id),
        ),
    ).toHaveLength(0);
    const [task] = await db.select().from(schema.taskTable);
    expect(task).toMatchObject({ title: "Retain me", status: "archived" });
  });

  it("can copy only fields to a populated project and safely repeat the request", async () => {
    const { target, copy } = await fixture();
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: target.project.id,
        title: "Existing",
        status: "to-do",
        number: 1,
      })
      .returning();
    expect((await copy({ workflow: false })).status).toBe(200);
    const [field] = await db
      .select()
      .from(schema.customFieldDefinitionTable)
      .where(
        eq(schema.customFieldDefinitionTable.projectId, target.project.id),
      );
    await db
      .update(schema.customFieldValueTable)
      .set({ value: "缺陷" })
      .where(eq(schema.customFieldValueTable.fieldId, field.id));
    expect((await copy({ workflow: false })).status).toBe(200);
    expect(
      await db
        .select()
        .from(schema.customFieldDefinitionTable)
        .where(
          eq(schema.customFieldDefinitionTable.projectId, target.project.id),
        ),
    ).toHaveLength(1);
    const [value] = await db
      .select()
      .from(schema.customFieldValueTable)
      .where(eq(schema.customFieldValueTable.taskId, task.id));
    expect(value.value).toBe("缺陷");
  });

  it("rolls back the workflow too when a same-name field conflicts", async () => {
    const { target, copy } = await fixture();
    await db
      .insert(schema.customFieldDefinitionTable)
      .values({ projectId: target.project.id, name: "任务类型", type: "text" });
    expect((await copy()).status).toBe(409);
    const [column] = await db
      .select()
      .from(schema.columnTable)
      .where(eq(schema.columnTable.id, target.columns.todo.id));
    expect(column.name).toBe("To Do");
  });

  it("denies viewers and rejects a template from another workspace", async () => {
    const viewer = await fixture("viewer");
    expect((await viewer.copy()).status).toBe(403);
    const owned = await fixture();
    const other = await createWorkspaceMember({ role: "owner" });
    const foreign = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    expect(
      (await owned.copy({ sourceProjectId: foreign.project.id })).status,
    ).toBe(404);
  });

  it("rejects self-copy and an empty selection", async () => {
    const { target, copy } = await fixture();
    expect((await copy({ sourceProjectId: target.project.id })).status).toBe(
      400,
    );
    expect((await copy({ workflow: false, customFields: false })).status).toBe(
      400,
    );
  });

  it("rejects a template hidden by project access restrictions", async () => {
    const { owner, target, copy } = await fixture("admin");
    await restrictToProjects(owner.workspace.id, owner.user.id, [
      target.project.id,
    ]);
    expect((await copy()).status).toBe(403);
  });

  it("preserves automation rules and rejects archived template projects", async () => {
    const { source, target, copy } = await fixture();
    await db.insert(schema.workflowRuleTable).values({
      projectId: target.project.id,
      integrationType: "github",
      eventType: "issue.closed",
      columnId: target.columns.done.id,
    });
    expect((await copy()).status).toBe(409);
    expect(await db.select().from(schema.workflowRuleTable)).toHaveLength(1);
    await db
      .update(schema.projectTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.projectTable.id, source.project.id));
    expect((await copy({ workflow: false })).status).toBe(409);
  });
});
