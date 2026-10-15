// Checks user-facing download behavior while the real workbook tests cover XLSX contents.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { ExportTasksExcelRow } from "./export-tasks-excel-row";

const m = vi.hoisted(() => ({
  fetch: vi.fn(),
  save: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("file-saver", () => ({ saveAs: m.save }));
vi.mock("@/fetchers/task/export-spreadsheet-data", () => ({
  default: m.fetch,
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: m.error, success: m.success },
}));
vi.mock("./task-workbook", () => ({
  createTaskWorkbook: () => ({
    xlsx: { writeBuffer: async () => new Uint8Array([80, 75]) },
  }),
}));

function show() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ExportTasksExcelRow projectId="p" projectSlug="项目:1" />
    </QueryClientProvider>,
  );
}

function openExport() {
  fireEvent.click(
    screen.getByRole("button", { name: "settings:excelExport.action" }),
  );
  expect(screen.getByRole("dialog")).toBeVisible();
}

describe("Excel export button", () => {
  afterEach(cleanup);
  beforeEach(() => vi.clearAllMocks());

  it("downloads an XLSX blob with a safe project filename after a click", async () => {
    m.fetch.mockResolvedValue({
      project: { exportedAt: "2026-10-15T08:00:00.000Z" },
    });
    show();
    expect(m.fetch).not.toHaveBeenCalled();
    openExport();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:excelExport.download" }),
    );
    await waitFor(() =>
      expect(m.save).toHaveBeenCalledWith(
        expect.any(Blob),
        "项目-1-tasks-2026-10-15.xlsx",
      ),
    );
    expect(m.fetch).toHaveBeenCalledWith("p", undefined);
  });

  it("requires a valid range and allows choosing a date type", async () => {
    m.fetch.mockResolvedValue({
      project: { exportedAt: "2026-10-15T08:00:00.000Z" },
    });
    show();
    openExport();
    expect(m.fetch).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("radio", { name: "settings:excelExport.dateRange" }),
    );
    const download = screen.getByRole("button", {
      name: "settings:excelExport.download",
    });
    expect(download).toBeDisabled();
    fireEvent.change(screen.getByLabelText("settings:excelExport.fromDay"), {
      target: { value: "2026-10-15" },
    });
    fireEvent.change(screen.getByLabelText("settings:excelExport.toDay"), {
      target: { value: "2026-10-14" },
    });
    expect(download).toBeDisabled();
    fireEvent.change(screen.getByLabelText("settings:excelExport.toDay"), {
      target: { value: "2026-10-15" },
    });
    fireEvent.click(
      screen.getByRole("combobox", { name: "settings:excelExport.dateField" }),
    );
    const option = await screen.findByRole("option", {
      name: "settings:excelExport.updatedAt",
    });
    fireEvent.pointerDown(option);
    fireEvent.mouseDown(option);
    fireEvent.pointerUp(option);
    fireEvent.mouseUp(option);
    fireEvent.click(option);
    expect(screen.getByRole("combobox")).toHaveTextContent(
      "settings:excelExport.updatedAt",
    );
    fireEvent.click(download);
    await waitFor(() => expect(m.save).toHaveBeenCalled());
    expect(m.fetch).toHaveBeenCalledWith("p", {
      dateField: "updatedAt",
      from: new Date(2026, 9, 15).toISOString(),
      until: new Date(2026, 9, 16).toISOString(),
    });
  });

  it("reports a failed export and allows another attempt without downloading", async () => {
    m.fetch.mockRejectedValue(new Error("No project access"));
    show();
    openExport();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:excelExport.download" }),
    );
    await waitFor(() =>
      expect(m.error).toHaveBeenCalledWith("No project access"),
    );
    expect(m.save).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "settings:excelExport.download" }),
    ).toBeEnabled();
  });
});
