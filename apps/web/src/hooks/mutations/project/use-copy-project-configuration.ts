// Refresh every affected configuration surface after a successful template copy.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import copyProjectConfiguration from "@/fetchers/project/copy-project-configuration";

export default function useCopyProjectConfiguration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: copyProjectConfiguration,
    onSuccess: async (_result, { id }) => {
      await Promise.all(
        ["columns", "custom-fields", "tasks"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key, id] }),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({
        queryKey: ["custom-field-values"],
      });
    },
  });
}
