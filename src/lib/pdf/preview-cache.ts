import type { PdfExportParams } from "./export-invoice";

/**
 * Bytes already drawn this session, keyed by the exact params that produced
 * them. Toggling a style back, or reopening the dialog on the same invoice,
 * redraws from memory instead of posting the document again — which is both
 * the difference between feeling instant and spending the export budget.
 */
const MAX_ENTRIES = 12;

const rendered = new Map<string, Uint8Array>();

/** The identity of a preview: the payload the renderer was given. */
export function pdfParamsKey(params: PdfExportParams): string {
  return JSON.stringify(params);
}

export function cachedPdf(key: string): Uint8Array | undefined {
  return rendered.get(key);
}

export function rememberPdf(key: string, bytes: Uint8Array): void {
  // Re-insert so the most recent preview is the last one evicted.
  rendered.delete(key);
  rendered.set(key, bytes);
  while (rendered.size > MAX_ENTRIES) {
    const oldest = rendered.keys().next().value;
    if (oldest === undefined) break;
    rendered.delete(oldest);
  }
}
