import { describe, expect, it } from "vitest";
import { balanceCents, fromCents, percentOfCents, recalculate, toCents } from "@/lib/money";

describe("toCents / fromCents", () => {
  it("converts decimal units to whole cents", () => {
    expect(toCents(0)).toBe(0);
    expect(toCents(1)).toBe(100);
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(0.005)).toBe(1);
    expect(toCents(0.004)).toBe(0);
  });

  it("rounds ties away from zero, including negatives", () => {
    expect(toCents(2.345)).toBe(235);
    expect(toCents(-2.345)).toBe(-235);
    expect(toCents(-0.005)).toBe(-1);
  });

  it("treats non-finite input as zero rather than NaN", () => {
    expect(toCents(Number.NaN)).toBe(0);
    expect(toCents(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("round-trips through fromCents", () => {
    expect(fromCents(1234)).toBe(12.34);
    expect(fromCents(toCents(99.99))).toBe(99.99);
  });
});

describe("percentOfCents", () => {
  it("returns zero for a zero rate", () => {
    expect(percentOfCents(1000, 0)).toBe(0);
  });

  it("rounds the result to the nearest cent", () => {
    expect(percentOfCents(999, 7.5)).toBe(75);
    expect(percentOfCents(100, 10.555)).toBe(11);
  });
});

describe("recalculate", () => {
  it("sums line totals in cents", () => {
    const totals = recalculate({
      lineItems: [
        { price: 100, quantity: 2 },
        { price: 0.1, quantity: 3 },
      ],
    });
    expect(totals.lineTotalsCents).toEqual([20000, 30]);
    expect(totals.subtotalCents).toBe(20030);
    expect(totals.totalCents).toBe(20030);
  });

  it("is cent-exact where floating point is not", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in raw doubles.
    const totals = recalculate({
      lineItems: [
        { price: 0.1, quantity: 1 },
        { price: 0.2, quantity: 1 },
      ],
    });
    expect(fromCents(totals.totalCents)).toBe(0.3);
  });

  it("applies line-level discount before line-level tax", () => {
    const totals = recalculate({
      lineItems: [{ price: 100, quantity: 1, discount: 10, tax: 20 }],
    });
    // 100.00 − 10% = 90.00, + 20% = 108.00
    expect(totals.lineTotalsCents).toEqual([10800]);
  });

  it("applies invoice discount to the subtotal, then invoice tax", () => {
    const totals = recalculate({
      lineItems: [{ price: 50, quantity: 2 }],
      discount: 20,
      tax: 10,
    });
    expect(totals.subtotalCents).toBe(10000);
    expect(totals.discountCents).toBe(2000);
    expect(totals.taxCents).toBe(800);
    expect(totals.totalCents).toBe(8800);
  });

  it("rounds every step, not just the final total", () => {
    const totals = recalculate({
      lineItems: [
        { price: 0.335, quantity: 1 },
        { price: 0.335, quantity: 1 },
      ],
    });
    expect(totals.lineTotalsCents).toEqual([34, 34]);
    expect(totals.subtotalCents).toBe(68);
  });

  it("handles an empty invoice", () => {
    expect(recalculate({ lineItems: [] }).totalCents).toBe(0);
  });

  it("accepts fractional quantities", () => {
    const totals = recalculate({ lineItems: [{ price: 80, quantity: 1.5 }] });
    expect(totals.totalCents).toBe(12000);
  });
});

describe("balanceCents", () => {
  it("is the total when nothing is paid", () => {
    expect(balanceCents(5000)).toBe(5000);
  });

  it("never goes negative", () => {
    expect(balanceCents(5000, 6000)).toBe(0);
  });
});
