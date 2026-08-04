import type { TemplateConfig } from "../templates/types";

export interface ExportableInvoice {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  invoiceType?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  lineItems: Array<{
    description: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  notes?: string;
}

export interface CompanyDetails {
  name?: string;
  fullName?: string;
  address?: string;
  email?: string;
  phone?: string;
}

export interface PdfExportParams {
  invoice: ExportableInvoice;
  currency?: string;
  company?: CompanyDetails;
  logo?: string;
  settingsNotes?: string;
  paperSize?: string;
  pdfDirectory?: string;
  accentColor?: string;
  secondaryColor?: string;
  template?: string;
  templateConfig?: TemplateConfig;
}

export async function exportInvoicePdf(params: PdfExportParams): Promise<Uint8Array> {
  const response = await fetch("/api/pdf/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let message = `PDF export failed (${response.status})`;
    try {
      const err = await response.json();
      if (err?.error) message = err.error;
    } catch {
      // ignore JSON parse failure; fall back to status message
    }
    throw new Error(message);
  }

  return new Uint8Array(await response.arrayBuffer());
}
