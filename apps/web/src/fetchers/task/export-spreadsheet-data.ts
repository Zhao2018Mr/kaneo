// Fetches a complete snapshot instead of exporting a possibly paginated board cache.
import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type SpreadsheetExportData = InferResponseType<
  (typeof client)["task"]["export"][":projectId"]["spreadsheet"]["$get"],
  200
>;

/** Reads all task data and custom fields the caller may export from a project. */
export default async function exportSpreadsheetData(projectId: string) {
  const response = await client.task.export[":projectId"].spreadsheet.$get({
    param: { projectId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
