import { describe, expect, it } from "vitest";
import { EXPORT_VERSION, validateExportFile } from "@/lib/exchange";

const minimal = {
  version: EXPORT_VERSION,
  exportedAt: "2026-03-14T00:00:00.000Z",
  company: { name: "Acme", id: "should-be-dropped", workspaceId: "nope" },
  settings: { currency: "EUR", unknownColumn: true },
  clients: [{ fullName: "Ada Lovelace", email: "ada@example.com" }],
  invoices: [
    {
      invoiceNumber: "INV-26-0001",
      issueDate: "2026-03-01T00:00:00.000Z",
      dueDate: null,
      discountPercent: 0,
      taxPercent: 0,
      lineItems: [{ description: "Design", price: 250.5, quantity: 2, discountPercent: 0, taxPercent: 0 }],
    },
  ],
};

describe("validateExportFile", () => {
  it("accepts a minimal file and reports what it would import", () => {
    const result = validateExportFile(minimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.counts).toEqual({ clients: 1, invoices: 1, lineItems: 1 });
    expect(result.file.invoices[0].invoiceNumber).toBe("INV-26-0001");
  });

  it("drops unknown columns instead of failing the insert later", () => {
    const result = validateExportFile(minimal);
    if (!result.ok) throw new Error("expected valid");
    expect(result.file.company).toEqual({ name: "Acme" });
    expect(result.file.settings).toEqual({ currency: "EUR" });
    if (result.file.company) expect("id" in result.file.company).toBe(false);
  });

  it("rejects another version", () => {
    const result = validateExportFile({ ...minimal, version: 99 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("Unsupported version");
  });

  it("rejects non-objects and missing arrays", () => {
    expect(validateExportFile(null).ok).toBe(false);
    expect(validateExportFile("{}").ok).toBe(false);
    const result = validateExportFile({ version: EXPORT_VERSION });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("`clients` must be an array");
      expect(result.errors).toContain("`invoices` must be an array");
    }
  });

  it("requires an invoice number and collects every problem", () => {
    const result = validateExportFile({
      ...minimal,
      invoices: [{ lineItems: [] }, { invoiceNumber: "INV-26-0002", lineItems: [] }],
      clients: [{ email: "no-name@example.com" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("invoices[0].invoiceNumber is required");
      expect(result.errors).toContain("clients[0].fullName is required");
    }
  });

  it("survives junk values inside otherwise valid records", () => {
    const result = validateExportFile({
      ...minimal,
      invoices: [
        {
          invoiceNumber: "INV-26-0003",
          issueDate: "not a date",
          lineItems: [{ description: 42, price: "abc", quantity: null }],
        },
      ],
    });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const invoice = result.file.invoices[0];
    expect(invoice.lineItems[0]).toMatchObject({ description: "42", price: 0, quantity: 1 });
    expect(invoice.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("guards against files that expand into too many records", () => {
    const result = validateExportFile({
      ...minimal,
      clients: Array.from({ length: 5_001 }, () => ({ fullName: "x" })),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("Too many clients");
  });
});
