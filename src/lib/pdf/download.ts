import { exportInvoicePdf, type PdfExportParams } from "./export-invoice";

export function pdfFilename(invoiceNumber: string, pdfDirectory?: string): string {
  const dir = (pdfDirectory || "").replace(/^\/+|\/+$/g, "").replace(/[/\\]/g, "_");
  return dir ? `${dir}_${invoiceNumber}.pdf` : `${invoiceNumber}.pdf`;
}

export function downloadPdfBuffer(buffer: Uint8Array, filename: string): void {
  const bytes = new Uint8Array(buffer);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads the previewed bytes when they match, regenerating otherwise. */
export async function downloadInvoicePdf(
  params: PdfExportParams,
  bytes?: Uint8Array
): Promise<void> {
  const buffer = bytes ?? (await exportInvoicePdf(params));
  downloadPdfBuffer(buffer, pdfFilename(params.invoice.invoiceNumber, params.pdfDirectory));
}
