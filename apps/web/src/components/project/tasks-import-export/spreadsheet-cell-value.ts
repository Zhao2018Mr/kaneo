/** Converts stored field values while keeping blanks distinct from zero and preserving invalid legacy text. */
export function spreadsheetCellValue(
  type: string,
  raw: string | null | undefined,
): string | number | boolean | null {
  if (raw == null || raw.trim() === "") return null;
  if (
    type === "number" &&
    /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(raw.trim())
  ) {
    const value = Number(raw);
    return Number.isFinite(value) ? value : raw;
  }
  if (type === "boolean" && (raw === "true" || raw === "false"))
    return raw === "true";
  if (type === "multiselect") {
    try {
      const values: unknown = JSON.parse(raw);
      if (Array.isArray(values) && values.every((v) => typeof v === "string"))
        return values.join("、");
    } catch {
      /* Legacy invalid JSON remains visible rather than being dropped. */
    }
  }
  return raw;
}
