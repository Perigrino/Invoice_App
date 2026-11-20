/**
 * The PDF is the client-facing document, so its labels follow the workspace's
 * language, not the sender's UI chrome.
 *
 * Arabic is deliberately absent: the PDF is drawn with the base-14 fonts, and
 * Courier/Helvetica/Times contain no Arabic glyphs. An Arabic workspace gets
 * the English document rather than a page of empty boxes.
 */
export type PdfLanguage = "en" | "fr" | "es";

export interface PdfLabels {
  invoice: string;
  proformaInvoice: string;
  description: string;
  qty: string;
  unitPrice: string;
  amount: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  signature: string;
  from: string;
  billTo: string;
  ref: string;
  issued: string;
  due: string;
  continued: string;
  page: string;
  thankYou: string;
}

const EN: PdfLabels = {
  invoice: "Invoice",
  proformaInvoice: "Proforma Invoice",
  description: "Description",
  qty: "Qty",
  unitPrice: "Unit price",
  amount: "Amount",
  subtotal: "Subtotal",
  discount: "Discount",
  tax: "Tax",
  total: "Total",
  signature: "Signature",
  from: "From",
  billTo: "Bill to",
  ref: "Ref",
  issued: "Issued",
  due: "Due",
  continued: "continued",
  page: "Page {pageNumber} of {totalPages}",
  thankYou: "Thank you for your business.",
};

const FR: PdfLabels = {
  invoice: "Facture",
  proformaInvoice: "Facture pro forma",
  description: "Description",
  qty: "Qté",
  unitPrice: "Prix unitaire",
  amount: "Montant",
  subtotal: "Sous-total",
  discount: "Remise",
  tax: "TVA",
  total: "Total",
  signature: "Signature",
  from: "De",
  billTo: "Facturé à",
  ref: "Réf.",
  issued: "Émise le",
  due: "Échéance",
  continued: "suite",
  page: "Page {pageNumber} sur {totalPages}",
  thankYou: "Merci pour votre confiance.",
};

const ES: PdfLabels = {
  invoice: "Factura",
  proformaInvoice: "Factura proforma",
  description: "Descripción",
  qty: "Cant.",
  unitPrice: "Precio unitario",
  amount: "Importe",
  subtotal: "Subtotal",
  discount: "Descuento",
  tax: "Impuesto",
  total: "Total",
  signature: "Firma",
  from: "De",
  billTo: "Facturado a",
  ref: "Ref.",
  issued: "Emitida",
  due: "Vence",
  continued: "continuación",
  page: "Página {pageNumber} de {totalPages}",
  thankYou: "Gracias por su confianza.",
};

const LABELS: Record<PdfLanguage, PdfLabels> = { en: EN, fr: FR, es: ES };

export function pdfLabels(language?: string): PdfLabels {
  const key = (language || "en").toLowerCase();
  return LABELS[key as PdfLanguage] ?? EN;
}
