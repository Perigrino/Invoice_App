import { renderToBuffer } from "@json-render/react-pdf";
import type { Spec } from "@json-render/core";
import type { PDFData } from "./types";
import { buildInvoiceSpec } from "./build-spec";
import { pdfRegistry } from "./registry";

export function buildInvoicePdfSpec(data: PDFData): Spec {
  return buildInvoiceSpec(data);
}

export async function generateInvoicePdfBuffer(data: PDFData): Promise<Uint8Array> {
  const spec = buildInvoiceSpec(data);
  return renderToBuffer(spec, { registry: pdfRegistry });
}
