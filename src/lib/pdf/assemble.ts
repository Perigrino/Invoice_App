import type { TemplateConfig } from "../templates/types";
import type { TemplateType } from "../../types";
import { mergeTemplateConfig } from "../templates/presets";
import type { PDFData } from "./types";
import type { ExportableInvoice, CompanyDetails } from "./export-invoice";

export interface PdfExportPayload {
  invoice: ExportableInvoice;
  currency?: string;
  company?: CompanyDetails;
  logo?: string;
  settingsNotes?: string;
  paperSize?: string;
  template?: string;
  accentColor?: string;
  secondaryColor?: string;
  templateConfig?: TemplateConfig;
}

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
  } = payload;

  const combinedNotes = [invoice.notes, settingsNotes].filter(Boolean).join("\n\n");
  const baseConfig: TemplateConfig =
    templateConfig ||
    mergeTemplateConfig({
      base: (template as TemplateType) || "modern",
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
    issueDate: new Date(invoice.issueDate).toLocaleDateString("en-GH"),
    dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-GH") : "—",
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
    discount: invoice.discount,
    total: invoice.total,
    notes: combinedNotes,
    currency,
    logo: normalizeLogo(logo),
    templateConfig: effectiveConfig,
  };
}
