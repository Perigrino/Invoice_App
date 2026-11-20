import "server-only";
import { createHash } from "node:crypto";
import type { PDFData } from "./types";
import { generateInvoicePdfBuffer } from "./generate-pdf";

/**
 * The preview posts every tweak, and a client that toggles a style back asks
 * for a document the server has just rendered. Rendering is a pure function of
 * the assembled data, so the bytes for one document are worth keeping for the
 * next caller. The promise is cached rather than the bytes, so identical
 * requests that arrive together share a single render.
 */
const MAX_ENTRIES = 40;

const renders = new Map<string, Promise<Uint8Array>>();

function cacheKey(data: PDFData): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export function renderInvoicePdf(data: PDFData): Promise<Uint8Array> {
  const key = cacheKey(data);
  const cached = renders.get(key);
  if (cached) return cached;

  const render = generateInvoicePdfBuffer(data);
  renders.set(key, render);
  while (renders.size > MAX_ENTRIES) {
    const oldest = renders.keys().next().value;
    if (oldest === undefined) break;
    renders.delete(oldest);
  }
  // A failed render must not become the answer for this document forever.
  render.catch(() => renders.delete(key));
  return render;
}
