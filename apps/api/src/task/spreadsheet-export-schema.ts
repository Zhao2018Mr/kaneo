// A half-open interval avoids losing sub-second timestamps on the selected final day.
import { z } from "../openapi";
export const spreadsheetExportRangeSchema = z.object({
  dateField: z.enum(["createdAt", "updatedAt", "startDate", "dueDate"]),
  from: z.iso
    .datetime({ offset: true })
    .openapi({ description: "Inclusive start instant, with timezone." }),
  until: z.iso.datetime({ offset: true }).openapi({
    description:
      "Exclusive end instant, with timezone. Use the midnight after the last selected day.",
  }),
});
/** Date filtering is optional; when supplied, both boundaries and an allowed task date are required. */
export type SpreadsheetExportRange = z.infer<
  typeof spreadsheetExportRangeSchema
>;
export const spreadsheetExportQuery = spreadsheetExportRangeSchema
  .partial()
  .superRefine((value, ctx) => {
    if (!Object.values(value).some((v) => v !== undefined)) return;
    if (!value.dateField || !value.from || !value.until) {
      ctx.addIssue({
        code: "custom",
        message: "dateField, from and until must be supplied together",
      });
    } else if (Date.parse(value.from) >= Date.parse(value.until)) {
      ctx.addIssue({
        code: "custom",
        path: ["until"],
        message: "until must be later than from",
      });
    }
  });
