import { useTranslation } from "react-i18next";
import { useProjectWebSocket } from "@/hooks/use-project-websocket";
import { cn } from "@/lib/cn";
import type { buildWorkspaceReport } from "./workspace-report";

type Props = {
  project: ReturnType<typeof buildWorkspaceReport>["projects"][number];
  statuses: { key: string; label: string }[];
  onSelect: (projectId: string, statusKey: string) => void;
};

export function WorkspaceReportRow({ project, statuses, onSelect }: Props) {
  const { t } = useTranslation();
  useProjectWebSocket(project.id);
  return (
    <tr className="border-t border-border hover:bg-muted/20">
      <th
        scope="row"
        className="sticky left-0 z-10 max-w-64 bg-background px-4 py-3 text-left font-medium"
      >
        <span className="block truncate" title={project.name}>
          {project.name}
        </span>
      </th>
      <td className="px-3 py-2 text-right tabular-nums">
        <button
          type="button"
          className="min-h-9 min-w-9 rounded px-2 font-semibold text-primary hover:bg-accent"
          aria-label={t("tasks:reports.viewProjectTotal", {
            project: project.name,
            count: project.total,
          })}
          onClick={() => onSelect(project.id, "")}
        >
          {project.total}
        </button>
      </td>
      {statuses.map((status) => {
        const count = project.counts.get(status.key) ?? 0;
        return (
          <td key={status.key} className="px-3 py-2 text-right tabular-nums">
            <button
              type="button"
              className={cn(
                "min-h-9 min-w-9 rounded px-2 hover:bg-accent",
                count ? "font-medium text-primary" : "text-muted-foreground",
              )}
              aria-label={t("tasks:reports.viewStatus", {
                project: project.name,
                status: status.label,
                count,
              })}
              onClick={() => onSelect(project.id, status.key)}
            >
              {count}
            </button>
          </td>
        );
      })}
    </tr>
  );
}
