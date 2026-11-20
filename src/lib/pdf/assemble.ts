import type { TemplateConfig } from "../templates/types";
import { normalizeTemplate } from "../templates/presets";
import { mergeTemplateConfig } from "../templates/presets";
import type { PDFData } from "./types";
import { formatDate } from "../utils";
import type { PdfExportParams } from "./export-invoice";

/** One shape for the client payload and the server's input. */
export type PdfExportPayload = PdfExportParams;

function normalizeLogo(logo?: string): string | undefined {
  if (!logo) return logo;
  if (logo.startsWith("data:")) return logo;
  const trimmed = logo.trimStart();
  if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
    const fixed = logo.replace(/<image\s+href=/gi, "<image src=");
    return `data:image/svg+xml;base64,${Buffer.from(fixed).toString("base64")}`;
  }
  return logo;
}

export function assemblePdfData(payload: PdfExportPayload): PDFData {
  const {
    invoice,
    currency,
    company = {},
    logo,
    settingsNotes,
    paperSize,
    template,
    accentColor,
    secondaryColor,
    templateConfig,
    dateFormat,
    numberFormat,
    language,
  } = payload;

  const combinedNotes = [invoice.notes, settingsNotes].filter(Boolean).join("\n\n");
  const baseConfig: TemplateConfig =
    templateConfig ||
    mergeTemplateConfig({
      base: normalizeTemplate(template),
    });

  const effectiveConfig: TemplateConfig = {
    ...baseConfig,
    accentColor: accentColor || baseConfig.accentColor,
    secondaryColor: secondaryColor || baseConfig.secondaryColor,
  };

  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceType: invoice.invoiceType || "invoice",
    paperSize: paperSize || "A3",
    issueDate: formatDate(invoice.issueDate, dateFormat),
    dueDate: invoice.dueDate ? formatDate(invoice.dueDate, dateFormat) : "—",
    companyName: company.name || company.fullName || "",
    companyAddress: company.address || "",
    companyEmail: company.email || "",
    companyPhone: company.phone || "",
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    clientPhone: invoice.clientPhone,
    clientAddress: invoice.clientAddress || "",
    lineItems: invoice.lineItems.map((item) => ({
      ...item,
      total: item.price * item.quantity,
    })),
    subtotal: invoice.subtotal,
    discountAmount: invoice.discountAmount,
    taxAmount: invoice.taxAmount ?? 0,
    total: invoice.total,
    notes: combinedNotes,
    currency,
    logo: normalizeLogo(logo),
    templateConfig: effectiveConfig,
    dateFormat,
    numberFormat,
    language,
  };
}
