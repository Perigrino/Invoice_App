import { describe, expect, it } from "vitest";
import {
  formatInvoiceNumber,
  nextInvoiceNumber,
  nextSequence,
  parseSequence,
} from "@/lib/numbering";

const inMarch2026 = new Date(2026, 2, 14);

describe("formatInvoiceNumber", () => {
  it("pads the year and the sequence", () => {
    expect(formatInvoiceNumber(inMarch2026, 1)).toBe("INV-26-0001");
    expect(formatInvoiceNumber(inMarch2026, 42)).toBe("INV-26-0042");
  });

  it("keeps growing past four digits", () => {
    expect(formatInvoiceNumber(inMarch2026, 12345)).toBe("INV-26-12345");
  });
});

describe("parseSequence", () => {
  it("reads the sequence for the matching year", () => {
    expect(parseSequence("INV-26-0007", inMarch2026)).toBe(7);
  });

  it("ignores numbers from another year", () => {
    expect(parseSequence("INV-25-0007", inMarch2026)).toBeNull();
  });

  it("ignores malformed numbers", () => {
    expect(parseSequence("INV-26-abc", inMarch2026)).toBeNull();
    expect(parseSequence("DRAFT-1", inMarch2026)).toBeNull();
  });
});

describe("nextSequence / nextInvoiceNumber", () => {
  it("starts at one for an empty workspace", () => {
    expect(nextInvoiceNumber([], inMarch2026)).toBe("INV-26-0001");
  });

  it("continues after the highest number, not the count", () => {
    const numbers = ["INV-26-0001", "INV-26-0004", "INV-26-0002"];
    expect(nextSequence(numbers, inMarch2026)).toBe(5);
  });

  it("restarts each year", () => {
    expect(nextInvoiceNumber(["INV-25-0099", "INV-24-0011"], inMarch2026)).toBe("INV-26-0001");
  });

  it("ignores other shapes such as duplicates and placeholders", () => {
    const numbers = ["INV-26-0003", "INV-26-0003-copy", "INV-00001"];
    expect(nextInvoiceNumber(numbers, inMarch2026)).toBe("INV-26-0004");
  });
});
