import { describe, expect, it } from "vitest";
import type { Spec } from "@json-render/core";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { assemblePdfData, type PdfExportPayload } from "@/lib/pdf/assemble";
import { buildInvoicePdfSpec } from "@/lib/pdf/generate-pdf";
import { generateInvoicePdfBuffer } from "@/lib/pdf/generate-pdf";
import { mergeTemplateConfig } from "@/lib/templates/presets";
import { buildInvoiceSpec } from "@/lib/pdf/build-spec";
import type { TemplateConfig } from "@/lib/templates/types";

interface SpecElement {
  type: string;
  props: Record<string, unknown>;
  children: string[];
}

function elementsOf(spec: Spec): SpecElement[] {
  return Object.values(spec.elements as Record<string, SpecElement>);
}

function pageCount(spec: Spec): number {
  return elementsOf(spec).filter((element) => element.type === "Page").length;
}

const longDescriptions = [
  "Website redesign — discovery workshop, wireframes and five responsive page templates",
  "Monthly retainer for brand and marketing support, September 2026",
  "Extra revisions beyond the two rounds included in the original scope of work",
  "Photography licence — 24 images, web and print usage, worldwide, perpetual",
  "Hosting and maintenance, annual renewal, including nightly encrypted backups",
  "Copywriting for the launch campaign, six emails and two landing pages",
  "Analytics dashboard setup and a one-hour walkthrough with the marketing team",
  "Priority support, twelve months, four-hour response window on business days",
  "Additional workshop facilitation for the leadership team, two sessions",
  "Travel and accommodation for the on-site kickoff in Accra",
  "Quarterly performance report with recommendations for the next quarter",
  "Design system documentation and component library handover",
];

function payload(overrides: Partial<PdfExportPayload> = {}): PdfExportPayload {
  const items = longDescriptions.slice(0, 10).map((description, index) => ({
    description,
    price: [1250, 4800, 375.5, 2100, 640, 950, 320, 1800, 725, 430][index] ?? 100,
    quantity: [1, 2, 3, 1, 4, 2, 1, 5, 2, 1][index] ?? 1,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return {
    invoice: {
      invoiceNumber: "INV-2026-0042",
      issueDate: "2026-11-19",
      dueDate: "2026-12-19",
      invoiceType: "invoice",
      clientName: "Northerly Design Collective",
      clientEmail: "accounts@northerly.example",
      clientAddress: "14 Independence Avenue\nAccra, Ghana",
      lineItems: items,
      subtotal,
      discountAmount: 1250.55,
      taxAmount: (subtotal - 1250.55) * 0.15,
      total: subtotal - 1250.55 + (subtotal - 1250.55) * 0.15,
      notes: "Payment by bank transfer within 30 days. Thank you for your business.",
    },
    currency: "GHS",
    company: {
      name: "Pine & Co Studio",
      address: "2 Ring Road\nOsu, Accra",
      email: "billing@pineandco.example",
      phone: "+233 30 222 7890",
    },
    paperSize: "A4",
    template: "light",
    dateFormat: "DD/MM/YYYY",
    numberFormat: { separator: "comma", decimalPlaces: 2, signPlacement: "after" },
    ...overrides,
  };
}

function config(overrides: Partial<TemplateConfig> = {}): TemplateConfig {
  return mergeTemplateConfig({ base: "light", ...overrides });
}

async function textOfPages(bytes: Uint8Array): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = await doc.getPage(number);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => (item as { str?: string }).str ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
    );
  }
  await doc.destroy();
  return pages;
}

describe("multi-page PDF layout", () => {
  const matrix = [
    { paper: "A4", size: 9, template: "light" as const },
    { paper: "A4", size: 18, template: "light" as const },
    { paper: "A4", size: 18, template: "dark" as const },
    { paper: "A3", size: 9, template: "light" as const },
    { paper: "A3", size: 18, template: "dark" as const },
    { paper: "Letter", size: 12, template: "light" as const },
    { paper: "Legal", size: 7, template: "light" as const },
  ];

  it.each(matrix)(
    "renders $paper at $size pt on $template without overflow",
    async ({ paper, size, template }) => {
      const data = assemblePdfData(
        payload({
          paperSize: paper,
          template,
          templateConfig: config({ base: template, fontSize: size }),
        })
      );
      const spec = buildInvoicePdfSpec(data);
      const expectedPages = pageCount(spec);
      const bytes = await generateInvoicePdfBuffer(data);

      const doc = await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
      // Each spec page is one PDF page: more means a page's content overflowed.
      expect(doc.numPages).toBe(expectedPages);

      for (let number = 1; number <= doc.numPages; number += 1) {
        const page = await doc.getPage(number);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        for (const raw of content.items) {
          const item = raw as { str?: string; width?: number; transform?: number[] };
          if (!item.str || !item.transform || !item.width) continue;
          const x = item.transform[4];
          const y = item.transform[5];
          expect(x, `left overflow on page ${number}: ${item.str}`).toBeGreaterThan(30);
          expect(x + item.width, `right overflow on page ${number}: ${item.str}`).toBeLessThan(
            viewport.width - 30
          );
          expect(y, `bottom overflow on page ${number}: ${item.str}`).toBeGreaterThan(30);
        }
      }

      const pages = await textOfPages(bytes);
      // The table header is repeated on every page, including continuations.
      for (const [index, text] of pages.entries()) {
        expect(text, `page ${index + 1} has no table header`).toContain("Description");
        expect(text, `page ${index + 1} has no page number`).toContain(`Page ${index + 1} of ${pages.length}`);
      }
      // Totals live only on the last page.
      pages.slice(0, -1).forEach((text, index) => {
        expect(text, `totals leaked onto page ${index + 1}`).not.toContain("Subtotal");
      });
      expect(pages.at(-1)).toContain("Total");
    },
    60_000
  );

  it("keeps a single-page invoice to one page", async () => {
    const data = assemblePdfData(
      payload({
        invoice: {
          ...payload().invoice,
          lineItems: [{ description: "Consulting services", price: 500, quantity: 1 }],
        },
      })
    );
    expect(pageCount(buildInvoicePdfSpec(data))).toBe(1);
    const bytes = await generateInvoicePdfBuffer(data);
    const pages = await textOfPages(bytes);
    expect(pages).toHaveLength(1);
  });

  it("names and localises the document from its settings", () => {
    const fr = buildInvoiceSpec(
      assemblePdfData(
        payload({ language: "fr", dateFormat: "DD/MM/YYYY" })
      )
    );
    const texts = elementsOf(fr)
      .filter((element) => element.type === "Text")
      .map((element) => String(element.props.text));
    expect(texts.some((text) => text.startsWith("Facture"))).toBe(true);
    expect(texts).toContain("Prix unitaire");
    expect(texts).toContain("19/11/2026");
    expect(texts).toContain("Facturé à");
  });

  it("uses the document's decimal mark when grouping with spaces", () => {
    const textsOf = (language: string) =>
      elementsOf(
        buildInvoiceSpec(
          assemblePdfData(
            payload({
              language,
              numberFormat: { separator: "space", decimalPlaces: 2, signPlacement: "after" },
            })
          )
        )
      )
        .filter((element) => element.type === "Text")
        .map((element) => String(element.props.text));

    expect(textsOf("en").some((text) => text === "29 736.50 GHS")).toBe(true);
    expect(textsOf("fr").some((text) => text === "29 736,50 GHS")).toBe(true);
    expect(textsOf("es").some((text) => text === "29 736,50 GHS")).toBe(true);
  });

  it("sizes the logo from the template's logo size", () => {
    const imageOf = (logoSize: "small" | "medium" | "large") => {
      const data = assemblePdfData(
        payload({
          logo: "data:image/png;base64,AAAA",
          templateConfig: config({ styles: { logoSize } as TemplateConfig["styles"] }),
        })
      );
      return elementsOf(buildInvoiceSpec(data)).find((element) => element.type === "Image");
    };

    const small = Number(imageOf("small")?.props.height);
    const medium = Number(imageOf("medium")?.props.height);
    const large = Number(imageOf("large")?.props.height);
    expect(small).toBeLessThan(medium);
    expect(medium).toBeLessThan(large);
    // The height and width props are what react-pdf reads; a style box is ignored.
    expect(Number(imageOf("large")?.props.width)).toBeGreaterThan(0);
    expect(imageOf("large")?.props.style).toBeUndefined();
  });

  it("honours number formatting settings", () => {
    const data = assemblePdfData(
      payload({
        currency: "EUR",
        numberFormat: { separator: "dot", decimalPlaces: 3, signPlacement: "before" },
      })
    );
    const spec = buildInvoiceSpec(data);
    const texts = elementsOf(spec)
      .filter((element) => element.type === "Text")
      .map((element) => String(element.props.text));
    expect(texts.some((text) => /^EUR \d{1,3}(\.\d{3})*,\d{3}$/.test(text))).toBe(true);
  });

  it("applies template toggles, fonts, title and zebra rows", () => {
    const cfg = config({
      base: "light",
      font: "serif",
      styles: {
        tableHeaderFill: false,
        zebraRows: true,
        totalsFill: true,
        title: "STATEMENT",
        logoSize: "large",
      } as TemplateConfig["styles"],
      components: {
        ...mergeTemplateConfig({ base: "light" }).components,
        qtyColumn: false,
        signature: true,
        footer: false,
        notes: false,
      },
    });
    const spec = buildInvoiceSpec(assemblePdfData(payload({ templateConfig: cfg })));
    const elements = elementsOf(spec);
    const texts = elements
      .filter((element) => element.type === "Text")
      .map((element) => String(element.props.text));

    expect(texts.some((text) => text.includes("STATEMENT"))).toBe(true);
    expect(texts).not.toContain("Qty");
    expect(texts).toContain("Signature");
    expect(texts).not.toContain("Payment by bank transfer within 30 days. Thank you for your business.");
    expect(elements.filter((element) => element.type === "PageNumber")).toHaveLength(0);
    // Serif reaches the text elements.
    const bodyText = elements.find(
      (element) => element.type === "Text" && element.props.text === "Description"
    );
    expect(bodyText?.props.fontFamily).toBe("Times-Roman");
    // Zebra rows put a background on alternating item rows.
    const fills = elements
      .filter((element) => element.type === "View")
      .map((element) => (element.props.style as Record<string, unknown> | undefined)?.backgroundColor)
      .filter(Boolean);
    expect(new Set(fills).size).toBeGreaterThan(2);
  });

  it("writes document metadata", () => {
    const spec = buildInvoiceSpec(assemblePdfData(payload()));
    const doc = elementsOf(spec).find((element) => element.type === "Document");
    expect(doc?.props.title).toBe("Invoice INV-2026-0042");
    expect(doc?.props.author).toBe("Pine & Co Studio");
    expect(String(doc?.props.subject)).toContain("GHS");
  });
});
