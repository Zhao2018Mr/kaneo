// Keeps template copying opt-in and guards the workflow of populated projects.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { CopyProjectConfigurationRow } from "./copy-project-configuration-row";

const m = vi.hoisted(() => ({
  copy: vi.fn(),
  columns: [{ name: "待确认" }],
  projectsFailed: false,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({
    data: [
      { id: "target", name: "Target" },
      { id: "source", name: "Template" },
    ],
    isError: m.projectsFailed,
    isPending: false,
  }),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({ data: m.columns }),
}));
vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-fields-by-project",
  () => ({ default: () => ({ data: [{ name: "开发工时" }] }) }),
);
vi.mock("@/hooks/mutations/project/use-copy-project-configuration", () => ({
  default: () => ({ mutateAsync: m.copy, isPending: false }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("CopyProjectConfigurationRow", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    m.projectsFailed = false;
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
  });

  it("requires a template and disables workflow replacement for existing tasks", async () => {
    render(
      <CopyProjectConfigurationRow
        projectId="target"
        workspaceId="w"
        hasTasks
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:projectGeneral.copyConfiguration.action",
      }),
    );
    expect(
      await screen.findByRole("button", {
        name: "settings:projectGeneral.copyConfiguration.confirm",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: "settings:projectGeneral.copyConfiguration.workflow",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText("settings:projectGeneral.copyConfiguration.hasTasks"),
    ).toBeTruthy();
    expect(m.copy).not.toHaveBeenCalled();
  });

  it("shows lookup errors without offering an incomplete project list", () => {
    m.projectsFailed = true;
    render(
      <CopyProjectConfigurationRow
        projectId="target"
        workspaceId="w"
        hasTasks={false}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "settings:projectGeneral.copyConfiguration.loadError",
    );
    expect(
      screen.queryByRole("button", {
        name: "settings:projectGeneral.copyConfiguration.action",
      }),
    ).toBeNull();
  });

  it("previews a chosen template and copies only after confirmation", async () => {
    m.copy.mockResolvedValue({
      columnsCopied: 1,
      fieldsCopied: 1,
      fieldsSkipped: 0,
    });
    render(
      <CopyProjectConfigurationRow
        projectId="target"
        workspaceId="w"
        hasTasks={false}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:projectGeneral.copyConfiguration.action",
      }),
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Template" }));
    expect(screen.getByText(/待确认/)).toBeTruthy();
    expect(screen.getByText(/开发工时/)).toBeTruthy();
    expect(m.copy).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:projectGeneral.copyConfiguration.confirm",
      }),
    );
    await waitFor(() =>
      expect(m.copy).toHaveBeenCalledWith({
        id: "target",
        sourceProjectId: "source",
        workflow: true,
        customFields: true,
      }),
    );
  });
});
