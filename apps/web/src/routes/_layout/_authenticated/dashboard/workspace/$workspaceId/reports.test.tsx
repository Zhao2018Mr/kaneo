import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
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
  getProjects: vi.fn(),
  getTasks: vi.fn(),
  subscribe: vi.fn(),
  navigate: vi.fn(),
  search: {} as { taskId?: string },
  workspaceId: "workspace",
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => {
    m.component = options.component;
    return {
      useParams: () => ({ workspaceId: m.workspaceId }),
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
vi.mock("@/components/common/workspace-layout", () => ({
  default: ({
    children,
    headerActions,
  }: {
    children: ReactNode;
    headerActions: ReactNode;
  }) => (
    <div>
      {headerActions}
      {children}
    </div>
  ),
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
vi.mock("@/lib/i18n/domain", () => ({
  getStatusDisplayLabel: (status: string, name?: string) => name || status,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === "tasks:reports.viewStatus")
        return `${values?.project} ${values?.status} ${values?.count}`;
      if (key === "tasks:reports.viewProjectTotal")
        return `${values?.project} total ${values?.count}`;
      return key;
    },
  }),
}));
await import("./reports");

const projects = [
  { id: "alpha", name: "Alpha", slug: "ALP" },
  { id: "beta", name: "Beta", slug: "BET" },
];
function task(id: string, projectId: string, status: string) {
  return { id, projectId, status, title: id, number: 1, assigneeName: "Alex" };
}
function board(id: string) {
  return {
    id,
    name: id,
    slug: id,
    columns: [
      { id: "todo", name: "待做", tasks: [task(`${id}-todo`, id, "todo")] },
      { id: "hold", name: "暂停", tasks: [task(`${id}-paused`, id, "hold")] },
    ],
    plannedTasks: [task(`${id}-planned`, id, "planned")],
    archivedTasks: [task(`${id}-archived`, id, "archived")],
  };
}
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  m.workspaceId = "workspace";
  m.search = {};
  m.getProjects.mockResolvedValue(projects);
  m.getTasks.mockImplementation(async (id: string) => board(id));
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.resetAllMocks();
});
function show() {
  const Component = m.component;
  return render(
    <QueryClientProvider client={client}>
      <Component />
    </QueryClientProvider>,
  );
}

describe("project reports", () => {
  it("shows per-project counts including planned and archived tasks, then drills into paused tasks", async () => {
    client.setQueryData(["tasks", "private"], board("private"));
    show();
    await screen.findByRole("button", { name: "Alpha total 4" });
    expect(
      screen.getByRole("button", { name: "Beta total 4" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "tasks:reports.allProjects 暂停 2" }),
    ).toBeInTheDocument();
    expect(m.getTasks.mock.calls.map(([id]) => id).sort()).toEqual([
      "alpha",
      "beta",
    ]);
    expect(m.getTasks).toHaveBeenCalledWith("alpha", expect.any(AbortSignal));
    expect(m.subscribe).toHaveBeenCalledWith("alpha");
    fireEvent.click(screen.getByRole("button", { name: "Alpha 暂停 1" }));
    const details = screen.getByRole("region", {
      name: "tasks:reports.details",
    });
    expect(within(details).getByText("alpha-paused")).toBeInTheDocument();
    expect(within(details).queryByText("beta-paused")).not.toBeInTheDocument();
    expect(within(details).queryByText("alpha-todo")).not.toBeInTheDocument();
    fireEvent.click(
      within(details).getByRole("button", { name: /alpha-paused/ }),
    );
    expect(m.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: { taskId: "alpha-paused" } }),
    );
    fireEvent.change(screen.getByLabelText("tasks:reports.projectFilter"), {
      target: { value: "" },
    });
    expect(screen.getByText("beta-paused")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("tasks:reports.statusFilter"), {
      target: { value: "archived" },
    });
    expect(screen.getByText("alpha-archived")).toBeInTheDocument();
    expect(screen.queryByText("alpha-paused")).not.toBeInTheDocument();
  });

  it("never presents a partial load as a complete zero-count report and can retry", async () => {
    m.getTasks.mockRejectedValueOnce(new Error("forbidden"));
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "tasks:reports.loadError",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "common:error.tryAgain" }),
    );
    expect(
      await screen.findByRole("button", { name: "Alpha total 4" }),
    ).toBeInTheDocument();
  });

  it("updates counts and the detail list after the shared board cache changes", async () => {
    show();
    await screen.findByRole("button", { name: "Alpha 暂停 1" });
    const updated = board("alpha");
    updated.columns[1].tasks.push(task("another-paused", "alpha", "hold"));
    client.setQueryData(["tasks", "alpha"], updated);
    expect(
      await screen.findByRole("button", { name: "Alpha 暂停 2" }),
    ).toBeInTheDocument();
    expect(screen.getByText("another-paused")).toBeInTheDocument();
  });

  it("keeps task details associated with their project when filters change", async () => {
    m.search = { taskId: "beta-paused" };
    show();
    await screen.findByRole("button", { name: "Alpha total 4" });
    fireEvent.click(screen.getByRole("button", { name: "Alpha 暂停 1" }));
    expect(screen.getByTestId("details")).toHaveTextContent("beta:beta-paused");
  });

  it("shows an empty workspace state without fetching unrelated boards", async () => {
    m.getProjects.mockResolvedValue([]);
    show();
    await screen.findByText("tasks:reports.noProjects");
    expect(m.getTasks).not.toHaveBeenCalled();
  });

  it("paginates details without changing the project totals", async () => {
    m.getProjects.mockResolvedValue([projects[0]]);
    m.getTasks.mockResolvedValue({
      ...board("alpha"),
      columns: [
        {
          id: "todo",
          name: "待做",
          tasks: Array.from({ length: 51 }, (_, index) =>
            task(`requirement-${index}`, "alpha", "todo"),
          ),
        },
      ],
      plannedTasks: [],
      archivedTasks: [],
    });
    show();
    await screen.findByRole("button", { name: "Alpha total 51" });
    expect(screen.getByText("requirement-0")).toBeInTheDocument();
    expect(screen.queryByText("requirement-50")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "tasks:reports.next" }));
    expect(screen.getByText("requirement-50")).toBeInTheDocument();
    expect(screen.queryByText("requirement-0")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("tasks:reports.statusFilter"), {
      target: { value: "archived" },
    });
    expect(
      screen.getByText("tasks:reports.noMatchingTasks"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Alpha total 51" }),
    ).toBeInTheDocument();
  });
});
