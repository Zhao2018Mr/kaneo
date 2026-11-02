import { useProjectWebSocket } from "@/hooks/use-project-websocket";

/** 保持工作区甘特图中各项目的任务和日期与其他协作者实时同步。 */
export function WorkspaceGanttSubscription({
  projectId,
}: {
  projectId: string;
}) {
  useProjectWebSocket(projectId);
  return null;
}
