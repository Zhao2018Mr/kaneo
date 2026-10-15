// Uses the typed API so conflict and permission errors follow normal UI handling.
import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

type Request = InferRequestType<
  (typeof client)["project"][":id"]["copy-configuration"]["$post"]
>;

/** Copies selected settings atomically; same-name conflicts leave the project unchanged. */
export default async function copyProjectConfiguration({
  id,
  ...selection
}: Request["json"] & { id: string }) {
  const response = await client.project[":id"]["copy-configuration"].$post({
    param: { id },
    json: selection,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
