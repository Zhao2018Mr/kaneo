// Copies reusable project settings atomically; task data always stays in place.
import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { assertValidDefinition } from "../../custom-field/assert-valid-definition";
import { insertMissingValues } from "../../custom-field/fill-default-values";
import db from "../../database";
import {
  columnTable,
  customFieldDefinitionTable,
  projectTable,
  taskTable,
  workflowRuleTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { findInaccessibleProjectIds } from "../../project-access/find-inaccessible-project-ids";

type CopySelection = {
  sourceProjectId: string;
  workflow: boolean;
  customFields: boolean;
};

/**
 * Copies statuses to an empty project and appends compatible custom fields.
 * Existing field values are preserved. Conflicts roll back the entire copy.
 * @throws HTTPException when access is denied or selected settings cannot safely be copied.
 */
export default async function copyProjectConfiguration(
  targetProjectId: string,
  workspaceId: string,
  userId: string,
  selection: CopySelection,
) {
  const { sourceProjectId, workflow, customFields } = selection;
  if (sourceProjectId === targetProjectId || (!workflow && !customFields)) {
    throw new HTTPException(400, {
      message: "Choose another project and at least one setting to copy.",
    });
  }

  const result = await db.transaction(async (tx) => {
    // Stable row locks prevent concurrent moves and task inserts from invalidating
    // the workspace and empty-project checks until the copy is committed.
    const projects = await tx
      .select()
      .from(projectTable)
      .where(
        and(
          inArray(projectTable.id, [sourceProjectId, targetProjectId]),
          eq(projectTable.workspaceId, workspaceId),
        ),
      )
      .orderBy(asc(projectTable.id))
      .for("update");
    if (projects.length !== 2) {
      throw new HTTPException(404, {
        message: "Both projects must exist in the same workspace.",
      });
    }
    if (
      (
        await findInaccessibleProjectIds(
          userId,
          [sourceProjectId, targetProjectId],
          tx,
        )
      ).length
    ) {
      throw new HTTPException(403, {
        message: "You don't have access to this project",
      });
    }
    if (projects.some((p) => p.archivedAt)) {
      throw new HTTPException(409, {
        message: "Unarchive the projects before copying configuration.",
      });
    }

    let columnsCopied = 0;
    let fieldsCopied = 0;
    let fieldsSkipped = 0;
    if (workflow) {
      const [task] = await tx
        .select({ id: taskTable.id })
        .from(taskTable)
        .where(eq(taskTable.projectId, targetProjectId))
        .limit(1);
      const [rule] = await tx
        .select({ id: workflowRuleTable.id })
        .from(workflowRuleTable)
        .where(eq(workflowRuleTable.projectId, targetProjectId))
        .limit(1);
      if (task || rule) {
        throw new HTTPException(409, {
          message:
            "Workflow copying requires a project with no tasks or automation rules. Copy only custom fields instead.",
        });
      }
      const columns = await tx
        .select()
        .from(columnTable)
        .where(eq(columnTable.projectId, sourceProjectId))
        .orderBy(asc(columnTable.position), asc(columnTable.id))
        .for("share");
      if (!columns.length) {
        throw new HTTPException(409, {
          message: "The template project has no workflow statuses.",
        });
      }
      await tx
        .delete(columnTable)
        .where(eq(columnTable.projectId, targetProjectId));
      await tx.insert(columnTable).values(
        columns.map(({ name, slug, position, icon, color, isFinal }) => ({
          projectId: targetProjectId,
          name,
          slug,
          position,
          icon,
          color,
          isFinal,
        })),
      );
      columnsCopied = columns.length;
    }

    if (customFields) {
      const definitions = await tx
        .select()
        .from(customFieldDefinitionTable)
        .where(
          inArray(customFieldDefinitionTable.projectId, [
            sourceProjectId,
            targetProjectId,
          ]),
        )
        .orderBy(
          asc(customFieldDefinitionTable.position),
          asc(customFieldDefinitionTable.id),
        )
        .for("update");
      const sourceFields = definitions.filter(
        (f) => f.projectId === sourceProjectId,
      );
      const targetFields = definitions.filter(
        (f) => f.projectId === targetProjectId,
      );
      let position = Math.max(0, ...targetFields.map((f) => f.position));
      for (const field of sourceFields) {
        const matches = targetFields.filter((f) => f.name === field.name);
        const settings = (f: typeof field) =>
          JSON.stringify([f.type, f.required, f.defaultValue, f.options]);
        if (matches.length) {
          if (
            matches.length !== 1 ||
            !matches[0] ||
            settings(matches[0]) !== settings(field)
          ) {
            throw new HTTPException(409, {
              message: `Custom field "${field.name}" already exists with different settings.`,
            });
          }
          fieldsSkipped++;
          continue;
        }
        assertValidDefinition({
          ...field,
          options: field.options as string[] | null,
        });
        const [created] = await tx
          .insert(customFieldDefinitionTable)
          .values({
            projectId: targetProjectId,
            name: field.name,
            type: field.type,
            required: field.required,
            defaultValue: field.defaultValue,
            options: field.options,
            position: ++position,
          })
          .returning();
        if (!created)
          throw new HTTPException(500, {
            message: "Failed to copy custom field",
          });
        // Only new fields receive defaults; never copy template task values or
        // refill an existing field whose value a user deliberately cleared.
        if (field.defaultValue != null && field.defaultValue.trim() !== "") {
          await insertMissingValues(tx, {
            projectId: targetProjectId,
            fieldId: created.id,
            value: field.defaultValue,
          });
        }
        targetFields.push(created);
        fieldsCopied++;
      }
    }
    return { columnsCopied, fieldsCopied, fieldsSkipped };
  });
  await publishEvent("project.updated", { projectId: targetProjectId });
  return result;
}
