// Keeps the existing JSON backup contract separate from spreadsheet reporting data.
import { columnListSchema } from "../column/response";
import { customFieldDefinitionListSchema } from "../custom-field/response";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  responseTimestamp,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import exportSpreadsheetData from "./controllers/export-spreadsheet-data";
import { taskSchema } from "./response";
import { projectIdParam } from "./schema";

const route = createRoute({
  method: "get",
  path: "/export/{projectId}/spreadsheet",
  operationId: "exportTaskSpreadsheetData",
  tags: ["Tasks"],
  summary: "Export complete task data for spreadsheets",
  description:
    "Read-only snapshot of all project tasks, including archived and planned tasks, full descriptions, assignee names, labels, workflow columns, custom field definitions and raw values. The web client creates the XLSX file locally. Board pagination and filters do not restrict this export.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["read"], task: ["read"] }),
  ] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Spreadsheet source data",
      z.object({
        project: z.object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
          description: z.string().nullable(),
          exportedAt: z.string(),
        }),
        columns: columnListSchema,
        fields: customFieldDefinitionListSchema,
        tasks: z.array(
          taskSchema.omit({ customFields: true }).extend({
            updatedAt: responseTimestamp,
            assigneeName: z.string().nullable(),
            labels: z.array(z.string()),
            customFieldValues: z.record(z.string(), z.string().nullable()),
          }),
        ),
      }),
    ),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Missing read permission or project access"),
    404: errorResponse("Project not found"),
    503: errorResponse("Export query timed out"),
  },
});

export default apiRouter<BaseVariables & { workspaceId: string }>().openapi(
  route,
  async (c) =>
    c.json(
      await exportSpreadsheetData(
        c.req.valid("param").projectId,
        c.get("workspaceId"),
      ),
      200,
    ),
);
