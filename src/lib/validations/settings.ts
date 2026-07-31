import { z } from "zod";

export const settingsSchema = z.object({
  currency: z.string().default("GHS"),
  separator: z.string().default("comma"),
  decimalPlaces: z.coerce.number().min(0).max(4).default(2),
  signPlacement: z.string().default("before"),
  dateFormat: z.string().default("MM/DD/YYYY"),
  pdfDirectory: z.string().default("/exports"),
  template: z.string().default("modern"),
  paperSize: z.string().default("A4"),
  showInvoiceId: z.boolean().default(true),
  showDueDate: z.boolean().default(true),
  showCurrency: z.boolean().default(true),
  showDiscount: z.boolean().default(true),
  showTax: z.boolean().default(true),
  showNote: z.boolean().default(true),
  language: z.string().default("en"),
  sound: z.string().default("default"),
  openPdfAfterExport: z.boolean().default(true),
  autoSave: z.boolean().default(true),
  darkMode: z.boolean().default(false),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
