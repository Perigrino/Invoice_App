import { Font } from "@react-pdf/renderer";
import { renderToBuffer } from "@json-render/react-pdf";
import type { Spec } from "@json-render/core";
import type { PDFData } from "./types";
import { buildInvoiceSpec } from "./build-spec";
import { pdfRegistry } from "./registry";

// react-pdf breaks words with English hyphenation patterns, which mangles the
// French and Spanish documents ("ga-ba-rits", "mar-keting"). Keep words whole,
// but split over-long tokens at punctuation so e-mails and URLs cannot run past
// their column.
Font.registerHyphenationCallback((word) => {
  if (word.length <= 18) return [word];
  const parts = word.match(/[^@._/\-]+[@._/\-]?/g) ?? [];
  return parts.length > 1 ? parts : [word];
});

export function buildInvoicePdfSpec(data: PDFData): Spec {
  return buildInvoiceSpec(data);
}

export async function generateInvoicePdfBuffer(data: PDFData): Promise<Uint8Array> {
  const spec = buildInvoiceSpec(data);
  return renderToBuffer(spec, { registry: pdfRegistry });
}
