import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import getTasks from "@/fetchers/task/get-tasks";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { markBoardCacheChanged } from "@/lib/board-cache-version";

/**
 * 跨项目视图复用看板分页读取及缓存，逐项目请求以保持原有权限检查。
 * 读取失败与空看板分开返回，避免报表把加载失败误计为零任务。
 */
export function useWorkspaceProjectBoards(workspaceId: string) {
  const queryClient = useQueryClient();
  const projectsQuery = useGetProjects({ workspaceId });
  const projects = useMemo(
    () => projectsQuery.data ?? [],
    [projectsQuery.data],
  );
  const taskQueries = useQueries({
    queries: projects.map((project) => ({
      queryKey: ["tasks", project.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        // Full board replacements must also expire deferred description reads.
        markBoardCacheChanged(queryClient, project.id);
        return getTasks(project.id, signal);
      },
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    })),
  });
  return {
    projects,
    projectBoards: projects.map((project, index) => ({
      project,
      board: taskQueries[index]?.isError ? undefined : taskQueries[index]?.data,
    })),
    isLoading:
      projectsQuery.isLoading || taskQueries.some((query) => query.isLoading),
    isFetching:
      projectsQuery.isFetching || taskQueries.some((query) => query.isFetching),
    hasError:
      projectsQuery.isError || taskQueries.some((query) => query.isError),
    refresh: () => {
      void projectsQuery.refetch();
      for (const query of taskQueries) void query.refetch();
    },
  };
}
