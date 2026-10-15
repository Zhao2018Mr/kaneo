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
vi.mock("react-i18next", () => ({
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

describe("Excel export button", () => {
  afterEach(cleanup);
  beforeEach(() => vi.clearAllMocks());

  it("downloads an XLSX blob with a safe project filename after a click", async () => {
    m.fetch.mockResolvedValue({
      project: { exportedAt: "2026-10-15T08:00:00.000Z" },
    });
    show();
    expect(m.fetch).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:excelExport.action" }),
    );
    await waitFor(() =>
      expect(m.save).toHaveBeenCalledWith(
        expect.any(Blob),
        "项目-1-tasks-2026-10-15.xlsx",
      ),
    );
    expect(m.fetch).toHaveBeenCalledWith("p");
  });

  it("reports a failed export and allows another attempt without downloading", async () => {
    m.fetch.mockRejectedValue(new Error("No project access"));
    show();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:excelExport.action" }),
    );
    await waitFor(() =>
      expect(m.error).toHaveBeenCalledWith("No project access"),
    );
    expect(m.save).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "settings:excelExport.action" }),
    ).toBeEnabled();
  });
});
