import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const m = vi.hoisted(() => ({
  component: (() => null) as ComponentType,
  search: {} as { taskId?: string },
  navigate: vi.fn(),
  getProjects: vi.fn(),
  getTasks: vi.fn(),
  subscribe: vi.fn(),
  updateTask: vi.fn(),
  mobile: false,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => {
    m.component = options.component;
    return {
      useParams: () => ({ workspaceId: "workspace" }),
      useSearch: () => m.search,
    };
  },
  useNavigate: () => m.navigate,
}));
vi.mock("@/fetchers/project/get-projects", () => ({ default: m.getProjects }));
vi.mock("@/fetchers/task/get-tasks", () => ({ default: m.getTasks }));
vi.mock("@/hooks/use-project-websocket", () => ({
  useProjectWebSocket: m.subscribe,
}));
vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync: m.updateTask }),
}));
vi.mock("@/components/common/workspace-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/task/task-details-sheet", () => ({
  default: ({ taskId, projectId }: { taskId?: string; projectId: string }) =>
    taskId ? (
      <output data-testid="details">
        {projectId}:{taskId}
      </output>
    ) : null,
}));
vi.mock("@/components/gantt/gantt-task-bar", () => ({
  GanttTaskBar: ({
    task,
    onOpenTask,
  }: {
    task: { id: string };
    onOpenTask: () => void;
  }) => <button onClick={onOpenTask}>bar:{task.id}</button>,
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => m.mobile }));
vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: () => 1,
}));
vi.mock("@/lib/i18n/domain", () => ({
  getStatusLabel: (status: string) => status,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

await import("./gantt");

const projects = [
  { id: "alpha", name: "Alpha", slug: "ALP" },
  { id: "beta", name: "Beta", slug: "BET" },
];
function task(
  id: string,
  projectId: string,
  startDate: string | null = "2026-11-01",
  assigneeId: string | null = null,
  assigneeName: string | null = null,
) {
  return {
    id,
    projectId,
    title: id,
    number: 1,
    status: "in-progress",
    startDate,
    dueDate: null,
    assigneeId,
    assigneeName,
  };
}
function board(projectId: string) {
  return {
    columns: [
      {
        tasks: [
          task(`${projectId}-task`, projectId),
          task(`${projectId}-unscheduled`, projectId, null, "member-1", "Alex"),
        ],
      },
    ],
    plannedTasks: [task(`${projectId}-planned`, projectId)],
    archivedTasks: [task(`${projectId}-archived`, projectId)],
  };
}
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnMount: false } },
  });
  m.search = {};
  m.mobile = false;
  m.getProjects.mockResolvedValue(projects);
  m.getTasks.mockImplementation(async (projectId: string) => board(projectId));
  m.updateTask.mockResolvedValue({});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
function show() {
  const Component = m.component;
  return render(
    <QueryClientProvider client={client}>
      <Component />
    </QueryClientProvider>,
  );
}

describe("workspace Gantt", () => {
  it("groups active and planned tasks from accessible projects and filters by project", async () => {
    client.setQueryData(["tasks", "unlisted"], board("unlisted"));
    show();
    const alpha = await screen.findByRole("region", { name: "Alpha" });
    expect(within(alpha).getByText("alpha-task")).toBeInTheDocument();
    expect(within(alpha).getByText("alpha-planned")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Beta" })).toBeInTheDocument();
    expect(screen.queryByText("alpha-archived")).not.toBeInTheDocument();
    const unscheduled = screen.getByRole("region", {
      name: "tasks:gantt.unscheduledTitle",
    });
    expect(
      within(unscheduled).getByText("alpha-unscheduled"),
    ).toBeInTheDocument();
    expect(
      within(unscheduled).getByText("beta-unscheduled"),
    ).toBeInTheDocument();
    expect(m.getTasks.mock.calls.map(([id]) => id).sort()).toEqual([
      "alpha",
      "beta",
    ]);
    expect(m.getTasks).toHaveBeenCalledWith("alpha", expect.any(AbortSignal));
    expect(m.subscribe).toHaveBeenCalledWith("beta");
    fireEvent.change(screen.getByLabelText("tasks:gantt.projectFilter"), {
      target: { value: "beta" },
    });
    expect(
      screen.queryByRole("region", { name: "Alpha" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Beta" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("tasks:gantt.projectFilter"), {
      target: { value: "" },
    });
    expect(screen.getByRole("region", { name: "Alpha" })).toBeInTheDocument();
  });

  it("filters both scheduled and unscheduled tasks by assignee", async () => {
    m.getTasks.mockImplementation(async (projectId: string) => ({
      columns: [
        {
          tasks: [
            task(
              `${projectId}-scheduled`,
              projectId,
              "2026-11-01",
              "member-1",
              "Alex",
            ),
            task(
              `${projectId}-other`,
              projectId,
              "2026-11-01",
              "member-2",
              "Sam",
            ),
            task(`${projectId}-unplanned`, projectId, null, "member-1", "Alex"),
          ],
        },
      ],
      plannedTasks: [],
    }));
    show();
    await screen.findByRole("region", { name: "Alpha" });
    fireEvent.change(screen.getByLabelText("tasks:gantt.assigneeFilter"), {
      target: { value: "member-1" },
    });
    expect(screen.getByText("alpha-scheduled")).toBeInTheDocument();
    expect(screen.getByText("alpha-unplanned")).toBeInTheDocument();
    expect(screen.queryByText("alpha-other")).not.toBeInTheDocument();
  });

  it("schedules a waiting task on the selected timeline date", async () => {
    m.getTasks.mockImplementation(async (projectId: string) => ({
      columns: [{ tasks: [task(`${projectId}-waiting`, projectId, null)] }],
      plannedTasks: [],
    }));
    show();
    await screen.findByText("alpha-waiting");
    const transfer = {
      types: ["text/kaneo-task-id"],
      getData: (type: string) =>
        type === "text/kaneo-task-id" ? "alpha-waiting" : "",
      dropEffect: "none",
      setData: vi.fn(),
    };
    fireEvent.drop(screen.getByLabelText("2026-11-01"), {
      dataTransfer: transfer,
    });
    await waitFor(() => {
      expect(m.updateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "alpha-waiting",
          startDate: new Date(2026, 10, 1).toISOString(),
          dueDate: new Date(2026, 10, 1).toISOString(),
        }),
      );
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "bar:alpha-waiting" }),
      ).toBeInTheDocument();
      const waiting = screen.getByRole("region", {
        name: "tasks:gantt.unscheduledTitle",
      });
      expect(
        within(waiting).queryByText("alpha-waiting"),
      ).not.toBeInTheDocument();
      expect(within(waiting).getByText("beta-waiting")).toBeInTheDocument();
    });
  });

  it("schedules from the task and date controls for keyboard and touch use", async () => {
    m.getTasks.mockImplementation(async (projectId: string) => ({
      columns: [{ tasks: [task(`${projectId}-waiting`, projectId, null)] }],
      plannedTasks: [],
    }));
    show();
    await screen.findByText("alpha-waiting");
    fireEvent.change(screen.getByLabelText("tasks:gantt.scheduleDate"), {
      target: { value: "2026-11-01" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:gantt.scheduleTask" }),
    );
    await waitFor(() => {
      expect(m.updateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "alpha-waiting",
          startDate: new Date(2026, 10, 1).toISOString(),
          dueDate: new Date(2026, 10, 1).toISOString(),
        }),
      );
    });
  });

  it("keeps an unscheduled task visible when saving its schedule fails", async () => {
    m.getTasks.mockImplementation(async (projectId: string) => ({
      columns: [{ tasks: [task(`${projectId}-waiting`, projectId, null)] }],
      plannedTasks: [],
    }));
    m.updateTask.mockRejectedValueOnce(new Error("offline"));
    show();
    const waitingTask = await screen.findByText("alpha-waiting");
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:gantt.scheduleTask" }),
    );
    await waitFor(() => expect(m.updateTask).toHaveBeenCalled());
    expect(waitingTask).toBeInTheDocument();
  });

  it("opens tasks in their own project even when another project is selected", async () => {
    m.search = { taskId: "beta-task" };
    show();
    await screen.findByRole("region", { name: "Beta" });
    expect(screen.getByTestId("details")).toHaveTextContent("beta:beta-task");
    fireEvent.click(screen.getByRole("button", { name: "bar:beta-task" }));
    expect(m.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: { taskId: "beta-task" },
        replace: true,
      }),
    );
    fireEvent.change(screen.getByLabelText("tasks:gantt.projectFilter"), {
      target: { value: "alpha" },
    });
    expect(screen.getByTestId("details")).toHaveTextContent("beta:beta-task");
  });

  it("shows project-list failures and retries instead of showing an empty timeline", async () => {
    m.getProjects.mockRejectedValueOnce(new Error("unavailable"));
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "tasks:gantt.loadError",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "common:error.tryAgain" }),
    );
    expect(
      await screen.findByRole("region", { name: "Alpha" }),
    ).toBeInTheDocument();
  });

  it("refreshes cached boards on return without losing existing shared cache keys", async () => {
    client.setQueryData(["tasks", "alpha"], {
      columns: [{ tasks: [task("stale", "alpha")] }],
      plannedTasks: [],
    });
    show();
    await waitFor(() =>
      expect(m.getTasks).toHaveBeenCalledWith("alpha", expect.any(AbortSignal)),
    );
    expect(await screen.findByText("alpha-task")).toBeInTheDocument();
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
  });

  it("provides a retry after task-loading failure", async () => {
    m.getTasks.mockRejectedValueOnce(new Error("failed"));
    show();
    await screen.findByRole("alert");
    fireEvent.click(
      screen.getByRole("button", { name: "common:error.tryAgain" }),
    );
    expect(
      await screen.findByRole("region", { name: "Alpha" }),
    ).toBeInTheDocument();
  });

  it("allows hiding the task rail on phones", async () => {
    m.mobile = true;
    show();
    await screen.findByRole("region", { name: "Alpha" });
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:gantt.showTasks" }),
    );
    expect(
      screen.getByRole("button", { name: "tasks:gantt.hideTasks" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
