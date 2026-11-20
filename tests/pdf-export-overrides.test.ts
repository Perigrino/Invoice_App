import { describe, expect, it } from "vitest";
import type { Spec } from "@json-render/core";
import { assemblePdfData, type PdfExportPayload } from "@/lib/pdf/assemble";
import { buildInvoicePdfSpec } from "@/lib/pdf/generate-pdf";
import { mergeTemplateConfig } from "@/lib/templates/presets";
import type { PaperSize } from "@/types";

interface SpecElement {
  type: string;
  props: Record<string, unknown>;
  children: string[];
}

/**
 * The payload shape the export dialog posts after its controls are applied:
 * paper and colours at the top level, font size inside the template config.
 */
function payload(overrides: Partial<PdfExportPayload> = {}): PdfExportPayload {
  return {
    invoice: {
      invoiceNumber: "INV-26-0001",
      issueDate: "2026-11-19",
      dueDate: "2026-12-19",
      invoiceType: "invoice",
      clientName: "Northerly Design",
      clientAddress: "14 Independence Avenue\nAccra",
      lineItems: [
        { description: "Website redesign", price: 1250, quantity: 2 },
        { description: "Monthly retainer", price: 480, quantity: 3 },
      ],
      subtotal: 3940,
      discountAmount: 0,
      taxAmount: 0,
      total: 3940,
      notes: "Payment within 30 days.",
    },
    currency: "GHS",
    company: { name: "Pine & Co", address: "2 Ring Road", email: "billing@pine.example" },
    template: "light",
    ...overrides,
  };
}

function elementsOf(spec: Spec): SpecElement[] {
  return Object.values(spec.elements as Record<string, SpecElement>);
}

function pageOf(spec: Spec): SpecElement {
  const page = elementsOf(spec).find((element) => element.type === "Page");
  if (!page) throw new Error("The spec has no page");
  return page;
}

function textElementsOf(spec: Spec): SpecElement[] {
  return elementsOf(spec).filter((element) => element.type === "Text");
}

function textWith(spec: Spec, content: string): SpecElement {
  const element = textElementsOf(spec).find((candidate) => candidate.props.text === content);
  if (!element) throw new Error(`No text element rendered "${content}"`);
  return element;
}

function styleOf(element: SpecElement): Record<string, unknown> {
  return (element.props.style as Record<string, unknown> | undefined) ?? {};
}

/** The page colour each element is drawn on, used to predict blended fills. */
function pageBackground(spec: Spec): string {
  return String(pageOf(spec).props.backgroundColor);
}

function channels(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** Independent copy of the spec's "opacity over the page" blend. */
function blend(bg: string, fg: string, alpha: number): string {
  const base = channels(bg);
  const over = channels(fg);
  return `#${base
    .map((value, index) => Math.round(value + (over[index] - value) * alpha))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

describe("per-export PDF overrides", () => {
  it.each<[PaperSize, string]>([
    ["A4", "A4"],
    ["A3", "A3"],
    ["Letter", "LETTER"],
    ["Legal", "LEGAL"],
  ])("sizes the page for %s", (paperSize, expected) => {
    const spec = buildInvoicePdfSpec(assemblePdfData(payload({ paperSize })));
    expect(pageOf(spec).props.size).toBe(expected);
  });

  it("falls back to A3 when the export carries no paper size", () => {
    const spec = buildInvoicePdfSpec(assemblePdfData(payload()));
    expect(pageOf(spec).props.size).toBe("A3");
  });

  it("sets the type size from the override", () => {
    const eighteen = buildInvoicePdfSpec(
      assemblePdfData(payload({ templateConfig: mergeTemplateConfig({ base: "light", fontSize: 18 }) }))
    );
    expect(styleOf(textWith(eighteen, "Description")).fontSize).toBe(18);
    expect(styleOf(textWith(eighteen, "Website redesign")).fontSize).toBe(18);
    // The total scales with the body text rather than staying fixed.
    expect(styleOf(textWith(eighteen, "Total")).fontSize).toBe(19);

    const seven = buildInvoicePdfSpec(
      assemblePdfData(payload({ templateConfig: mergeTemplateConfig({ base: "light", fontSize: 7 }) }))
    );
    expect(styleOf(textWith(seven, "Description")).fontSize).toBe(7);
    expect(styleOf(textWith(seven, "Total")).fontSize).toBe(8);
  });

  it("paints the accent from the override", () => {
    const accent = "#FF0000";
    const spec = buildInvoicePdfSpec(
      assemblePdfData(
        payload({
          accentColor: accent,
          templateConfig: mergeTemplateConfig({ base: "light", accentColor: accent }),
        })
      )
    );

    expect(styleOf(textWith(spec, "[ ")).color).toBe(accent);
    expect(styleOf(textWith(spec, "Total")).color).toBe(accent);
    // Ignore case: the spec may render the value exactly as given.
    const accentTexts = textElementsOf(spec).filter(
      (element) => String(styleOf(element).color).toUpperCase() === accent
    );
    expect(accentTexts.length).toBeGreaterThan(0);
  });

  it("tints the table header from the secondary override", () => {
    const secondary = "#0000FF";
    const spec = buildInvoicePdfSpec(
      assemblePdfData(
        payload({
          secondaryColor: secondary,
          templateConfig: mergeTemplateConfig({ base: "light", secondaryColor: secondary }),
        })
      )
    );

    const expectedFill = blend(pageBackground(spec), secondary, 0.2);
    const header = elementsOf(spec).find(
      (element) => styleOf(element).backgroundColor === expectedFill
    );
    expect(header, `no element filled with ${expectedFill}`).toBeDefined();
  });

  it("keeps the overrides distinct: another colour pair produces another spec", () => {
    const specWith = (accent: string, secondary: string) =>
      buildInvoicePdfSpec(
        assemblePdfData(
          payload({
            accentColor: accent,
            secondaryColor: secondary,
            templateConfig: mergeTemplateConfig({ base: "light", accentColor: accent, secondaryColor: secondary }),
          })
        )
      );

    const first = specWith("#FF0000", "#0000FF");
    const second = specWith("#00FF00", "#FF00FF");

    expect(styleOf(textWith(first, "Total")).color).toBe("#FF0000");
    expect(styleOf(textWith(second, "Total")).color).toBe("#00FF00");
    expect(JSON.stringify(first.elements)).not.toEqual(JSON.stringify(second.elements));
  });
});
