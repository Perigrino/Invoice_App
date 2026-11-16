/**
 * Invoice money lives in **integer cents** everywhere it is stored or summed.
 * The API still speaks decimal currency units because the UI, the PDF builder
 * and every template are written in them; conversion happens once, at the API
 * boundary, in `src/lib/invoice-mapping.ts`.
 *
 * Rounding is half-away-from-zero, the convention the Mac app's
 * `Decimal.roundedCents` uses, so `recalculate()` and the on-screen preview
 * agree to the cent.
 */

export const CENTS_PER_UNIT = 100;

/** Decimal currency units → integer cents, ties away from zero. */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  const scaled = amount * CENTS_PER_UNIT;
  return scaled >= 0 ? Math.round(scaled) : -Math.round(-scaled);
}

/** Integer cents → decimal currency units, for display and legacy callers. */
export function fromCents(cents: number): number {
  return Math.round(cents) / CENTS_PER_UNIT;
}

/** Applies a percentage to a cent amount, rounding to the nearest cent. */
export function percentOfCents(cents: number, percent: number): number {
  if (!percent) return 0;
  const raw = (cents * percent) / 100;
  return raw >= 0 ? Math.round(raw) : -Math.round(-raw);
}

export interface LineItemInput {
  /** Unit price in decimal currency units. */
  price: number;
  quantity: number;
  /** Percentage, 0–100. */
  discount?: number;
  /** Percentage, 0–100. */
  tax?: number;
}

export interface RecalculateInput {
  lineItems: LineItemInput[];
  /** Invoice-level discount, as a percentage of the subtotal. */
  discount?: number;
  /** Invoice-level tax, as a percentage of the discounted subtotal. */
  tax?: number;
}

export interface InvoiceTotals {
  lineTotalsCents: number[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

/**
 * The single source of truth for invoice arithmetic. The server calls it on
 * every write so a stale or hostile client cannot post its own totals.
 *
 * Order of operations: per-line `price × quantity`, less the line discount,
 * plus line tax → sum to subtotal → less the invoice discount → plus invoice
 * tax. Every step rounds to whole cents before the next one runs.
 */
export function recalculate(input: RecalculateInput): InvoiceTotals {
  const lineTotalsCents = (input.lineItems ?? []).map((item) => {
    const gross = toCents((Number(item.price) || 0) * (Number(item.quantity) || 0));
    const discount = percentOfCents(gross, Number(item.discount) || 0);
    const taxed = gross - discount;
    const tax = percentOfCents(taxed, Number(item.tax) || 0);
    return taxed + tax;
  });

  const subtotalCents = lineTotalsCents.reduce((sum, cents) => sum + cents, 0);
  const discountCents = percentOfCents(subtotalCents, Number(input.discount) || 0);
  const taxCents = percentOfCents(subtotalCents - discountCents, Number(input.tax) || 0);
  const totalCents = subtotalCents - discountCents + taxCents;

  return { lineTotalsCents, subtotalCents, discountCents, taxCents, totalCents };
}

/** Balance still owed: total minus what has been paid, never negative. */
export function balanceCents(totalCents: number, paidCents = 0): number {
  return Math.max(0, totalCents - paidCents);
}
