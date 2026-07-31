import { generateInvoicePDF } from "./generate-pdf";

interface ExportableInvoice {
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

interface CompanyDetails {
  name?: string;
  fullName?: string;
  address?: string;
  email?: string;
  phone?: string;
}

export function exportInvoicePdf(
  invoice: ExportableInvoice,
  currency = "GHS",
  company: CompanyDetails = {},
  logo?: string,
  settingsNotes?: string,
  paperSize?: string,
  pdfDirectory?: string,
  accentColor?: string,
  secondaryColor?: string
) {
  const combinedNotes = [invoice.notes, settingsNotes].filter(Boolean).join("\n\n");
  const document = generateInvoicePDF({
    invoiceNumber: invoice.invoiceNumber,
    invoiceType: invoice.invoiceType || "invoice",
    paperSize: paperSize || "A4",
    issueDate: new Date(invoice.issueDate).toLocaleDateString("en-GH"),
    dueDate: invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString("en-GH")
      : "—",
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
    logo,
    accentColor,
    secondaryColor,
  });

  const dir = (pdfDirectory || "").replace(/^\/+|\/+$/g, "").replace(/[/\\]/g, "_");
  const filename = dir ? `${dir}_${invoice.invoiceNumber}.pdf` : `${invoice.invoiceNumber}.pdf`;
  document.save(filename);
}
