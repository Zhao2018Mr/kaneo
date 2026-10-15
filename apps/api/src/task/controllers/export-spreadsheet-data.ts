// Reads a consistent export snapshot, including custom values omitted by JSON backups.
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  columnTable,
  customFieldDefinitionTable,
  customFieldValueTable,
  labelTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { boundedTaskRead } from "../bounded-read";
import type { SpreadsheetExportRange } from "../spreadsheet-export-schema";

/** Exports every task in the authorized project, including planned and archived tasks, optionally within one task date range. */
export default async function exportSpreadsheetData(
  projectId: string,
  workspaceId: string,
  range?: SpreadsheetExportRange,
) {
  return boundedTaskRead(async (tx) => {
    const [project] = await tx
      .select({
        id: projectTable.id,
        name: projectTable.name,
        slug: projectTable.slug,
        description: projectTable.description,
      })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.id, projectId),
          eq(projectTable.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!project)
      throw new HTTPException(404, { message: "Project not found" });

    const columns = await tx
      .select()
      .from(columnTable)
      .where(eq(columnTable.projectId, projectId))
      .orderBy(asc(columnTable.position), asc(columnTable.id));
    const fields = await tx
      .select()
      .from(customFieldDefinitionTable)
      .where(eq(customFieldDefinitionTable.projectId, projectId))
      .orderBy(
        asc(customFieldDefinitionTable.position),
        asc(customFieldDefinitionTable.id),
      );
    // The same predicate scopes task rows, labels and custom values in this snapshot.
    const taskScope = and(
      eq(taskTable.projectId, projectId),
      range
        ? and(
            gte(taskTable[range.dateField], new Date(range.from)),
            lt(taskTable[range.dateField], new Date(range.until)),
          )
        : undefined,
    );
    const tasks = await tx
      .select({
        id: taskTable.id,
        projectId: taskTable.projectId,
        number: taskTable.number,
        position: taskTable.position,
        title: taskTable.title,
        description: taskTable.description,
        status: taskTable.status,
        priority: taskTable.priority,
        userId: taskTable.userId,
        assigneeName: userTable.name,
        startDate: taskTable.startDate,
        dueDate: taskTable.dueDate,
        createdAt: taskTable.createdAt,
        updatedAt: taskTable.updatedAt,
      })
      .from(taskTable)
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .where(taskScope)
      .orderBy(
        asc(taskTable.position),
        asc(taskTable.number),
        asc(taskTable.id),
      );
    // Joins avoid an unbounded IN-list and scope both ends of a custom value to
    // this project, including legacy rows with mismatched field ownership.
    const values = await tx
      .select({
        taskId: customFieldValueTable.taskId,
        fieldId: customFieldValueTable.fieldId,
        value: customFieldValueTable.value,
      })
      .from(customFieldValueTable)
      .innerJoin(taskTable, eq(customFieldValueTable.taskId, taskTable.id))
      .innerJoin(
        customFieldDefinitionTable,
        eq(customFieldValueTable.fieldId, customFieldDefinitionTable.id),
      )
      .where(
        and(taskScope, eq(customFieldDefinitionTable.projectId, projectId)),
      );
    const labels = await tx
      .select({ taskId: labelTable.taskId, name: labelTable.name })
      .from(labelTable)
      .innerJoin(taskTable, eq(labelTable.taskId, taskTable.id))
      .where(taskScope)
      .orderBy(asc(labelTable.name));
    const valuesByTask = new Map<string, Record<string, string | null>>();
    for (const value of values) {
      const record = valuesByTask.get(value.taskId) ?? Object.create(null);
      record[value.fieldId] = value.value;
      valuesByTask.set(value.taskId, record);
    }
    const labelsByTask = new Map<string, string[]>();
    for (const label of labels) {
      if (!label.taskId) continue;
      const names = labelsByTask.get(label.taskId) ?? [];
      names.push(label.name);
      labelsByTask.set(label.taskId, names);
    }
    return {
      project: { ...project, exportedAt: new Date().toISOString() },
      ...(range ? { range } : {}),
      columns,
      fields,
      tasks: tasks.map((task) => ({
        ...task,
        labels: labelsByTask.get(task.id) ?? [],
        customFieldValues: valuesByTask.get(task.id) ?? {},
      })),
    };
  }, "Spreadsheet export took too long; retry later");
}
