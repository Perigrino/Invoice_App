import { fromCents, recalculate, toCents, type LineItemInput } from "@/lib/money";

export interface InvoiceLineRow {
  id: string;
  description: string;
  priceCents: number;
  quantity: number;
  discountPercent: number;
  taxPercent: number;
  totalCents: number;
  sortOrder: number;
}

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  clientId: string | null;
  status: string;
  subtotalCents: number;
  discountPercent: number;
  discountCents: number;
  taxPercent: number;
  taxCents: number;
  totalCents: number;
  balanceDueCents: number;
  notes: string | null;
  issueDate: Date;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  client?: { fullName: string; company: string | null } | null;
  lineItems: InvoiceLineRow[];
}

/**
 * Database rows (integer cents) → API JSON (decimal currency units). The UI,
 * the PDF builder and the templates all work in decimal units, so this is the
 * one place the two representations meet.
 */
export function serializeInvoice<T extends InvoiceRow>(invoice: T) {
  const { subtotalCents, discountCents, taxCents, totalCents, balanceDueCents, lineItems, ...rest } =
    invoice;

  return {
    ...rest,
    subtotal: fromCents(subtotalCents),
    discountPercent: invoice.discountPercent,
    discountAmount: fromCents(discountCents),
    taxPercent: invoice.taxPercent,
    taxAmount: fromCents(taxCents),
    total: fromCents(totalCents),
    balanceDue: fromCents(balanceDueCents),
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    lineItems: lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      price: fromCents(item.priceCents),
      quantity: item.quantity,
      discountPercent: item.discountPercent,
      taxPercent: item.taxPercent,
      total: fromCents(item.totalCents),
      sortOrder: item.sortOrder,
    })),
  };
}

export interface LineItemBody {
  description?: unknown;
  price?: unknown;
  quantity?: unknown;
  discountPercent?: unknown;
  taxPercent?: unknown;
}

export function lineItemsFromBody(body: { lineItems?: unknown }): LineItemBody[] {
  return Array.isArray(body.lineItems) ? (body.lineItems as LineItemBody[]) : [];
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Body → rows ready for Prisma, with totals computed by `recalculate` rather
 * than trusted from the client.
 */
export function buildLineItemWrites(body: {
  lineItems?: unknown;
  discountPercent?: unknown;
  taxPercent?: unknown;
}) {
  const items = lineItemsFromBody(body);
  const inputs: LineItemInput[] = items.map((item) => ({
    price: asNumber(item.price),
    quantity: asNumber(item.quantity, 1),
    discountPercent: asNumber(item.discountPercent),
    taxPercent: asNumber(item.taxPercent),
  }));

  // Invoice-level discount and tax are part of the arithmetic, not labels: the
  // stored percentages used to be written while the totals ignored them.
  const totals = recalculate({
    lineItems: inputs,
    discountPercent: asNumber(body.discountPercent),
    taxPercent: asNumber(body.taxPercent),
  });

  const rows = items.map((item, index) => ({
    description: String(item.description ?? ""),
    priceCents: toCents(asNumber(item.price)),
    quantity: asNumber(item.quantity, 1),
    discountPercent: asNumber(item.discountPercent),
    taxPercent: asNumber(item.taxPercent),
    totalCents: totals.lineTotalsCents[index] ?? 0,
    sortOrder: index,
  }));

  return { rows, totals };
}
