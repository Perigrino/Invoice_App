import { describe, expect, it } from "vitest";
import { buildLineItemWrites, serializeInvoice } from "@/lib/invoice-mapping";

describe("buildLineItemWrites", () => {
  it("computes totals in cents and ignores anything the client sent", () => {
    const { rows, totals } = buildLineItemWrites({
      lineItems: [
        { description: "Design", price: 250.5, quantity: 2, discountPercent: 0, taxPercent: 0, total: 999999 },
        { description: "Hosting", price: 12.25, quantity: 1, discountPercent: 0, taxPercent: 0 },
      ],
    });

    expect(rows[0].priceCents).toBe(25050);
    expect(rows[0].totalCents).toBe(50100);
    expect(rows[1].totalCents).toBe(1225);
    expect(totals.totalCents).toBe(51325);
    expect(rows.map((row) => row.sortOrder)).toEqual([0, 1]);
  });

  it("survives a body with no line items", () => {
    const { rows, totals } = buildLineItemWrites({});
    expect(rows).toEqual([]);
    expect(totals.totalCents).toBe(0);
  });
});

describe("serializeInvoice", () => {
  it("converts cents back to decimal units for the API", () => {
    const serialized = serializeInvoice({
      id: "inv_1",
      invoiceNumber: "INV-26-0001",
      invoiceType: "invoice",
      clientId: null,
      status: "draft",
      subtotalCents: 51325,
      discountPercent: 10,
      discountCents: 5133,
      taxPercent: 0,
      taxCents: 0,
      totalCents: 46192,
      balanceDueCents: 46192,
      notes: null,
      issueDate: new Date("2026-03-14T00:00:00Z"),
      dueDate: null,
      createdAt: new Date("2026-03-14T00:00:00Z"),
      updatedAt: new Date("2026-03-14T00:00:00Z"),
      lineItems: [
        {
          id: "li_1",
          description: "Design",
          priceCents: 25050,
          quantity: 2,
          discountPercent: 0,
          taxPercent: 0,
          totalCents: 50100,
          sortOrder: 0,
        },
      ],
    });

    expect(serialized.subtotal).toBe(513.25);
    expect(serialized.total).toBe(461.92);
    expect(serialized.discountPercent).toBe(10);
    expect(serialized.discountAmount).toBe(51.33);
    expect(serialized.lineItems[0].price).toBe(250.5);
    expect("subtotalCents" in serialized).toBe(false);
  });
});
