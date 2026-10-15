// The API owns permissions and transactional conflict handling for template copies.
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import copyProjectConfiguration from "./controllers/copy-project-configuration";
import { projectParam } from "./schema";

const copyConfigurationRoute = createRoute({
  method: "post",
  path: "/{id}/copy-configuration",
  operationId: "copyProjectConfiguration",
  tags: ["Projects"],
  summary: "Copy workflow statuses and custom fields from another project",
  description:
    "Copy settings from an accessible, active project in the same workspace. Workflow replacement requires an empty target without automation rules. Identical fields are skipped; conflicting same-name fields reject the whole transaction. New fields receive their configured defaults. Tasks, members, integrations and automation rules are not copied.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update", "read"] }),
  ] as const,
  request: {
    params: projectParam,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            sourceProjectId: z.string().min(1),
            workflow: z.boolean(),
            customFields: z.boolean(),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "Configuration copied",
      z.object({
        columnsCopied: z.number().int(),
        fieldsCopied: z.number().int(),
        fieldsSkipped: z.number().int(),
      }),
    ),
    400: errorResponse("Invalid selection or same project"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Missing permission or project access"),
    404: errorResponse("Projects not found in the same workspace"),
    409: errorResponse(
      "Archived project, occupied workflow, automation rules or conflicting fields",
    ),
  },
});

export default apiRouter<BaseVariables & { workspaceId: string }>().openapi(
  copyConfigurationRoute,
  async (c) =>
    c.json(
      await copyProjectConfiguration(
        c.req.valid("param").id,
        c.get("workspaceId"),
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
);
