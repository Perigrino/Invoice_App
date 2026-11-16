import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ExportFile } from "@/lib/exchange";
import { recalculate, toCents } from "@/lib/money";

/** Postgres caps a statement at 65535 parameters, so rows go in batches. */
const CLIENT_BATCH = 1_000;
const INVOICE_BATCH = 500;
const LINE_ITEM_BATCH = 2_000;

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 60_000 };

function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

/**
 * Replaces the workspace with a validated export file — the single write path
 * behind both import and snapshot restore. Ids are generated up front so the
 * whole thing is a handful of `createMany` statements rather than a round trip
 * per row, which is what keeps a large file inside the transaction budget.
 */
export async function replaceWorkspace(workspaceId: string, file: ExportFile): Promise<void> {
  const clientIds = file.clients.map(() => crypto.randomUUID());
  const clientRows: Prisma.ClientCreateManyInput[] = file.clients.map((client, index) => ({
    ...client,
    id: clientIds[index],
    workspaceId,
  }));

  const invoiceRows: Prisma.InvoiceCreateManyInput[] = [];
  const lineItemRows: Prisma.InvoiceLineItemCreateManyInput[] = [];

  for (const invoice of file.invoices) {
    const invoiceId = crypto.randomUUID();
    const totals = recalculate({
      lineItems: invoice.lineItems.map((item) => ({
        price: item.price,
        quantity: item.quantity,
        discount: item.discount,
        tax: item.tax,
      })),
      discount: invoice.discount,
      tax: invoice.tax,
    });

    invoiceRows.push({
      id: invoiceId,
      workspaceId,
      invoiceNumber: invoice.invoiceNumber,
      invoiceType: invoice.invoiceType,
      status: invoice.status,
      clientId:
        invoice.clientIndex !== null && clientIds[invoice.clientIndex]
          ? clientIds[invoice.clientIndex]
          : null,
      subtotalCents: totals.subtotalCents,
      discountPercent: invoice.discount,
      discountCents: totals.discountCents,
      taxPercent: invoice.tax,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      balanceDueCents: Math.max(0, totals.totalCents),
      notes: invoice.notes,
      issueDate: new Date(invoice.issueDate),
      dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
    });

    invoice.lineItems.forEach((item, index) => {
      lineItemRows.push({
        invoiceId,
        description: item.description,
        priceCents: toCents(item.price),
        quantity: item.quantity,
        discountPercent: item.discount,
        taxPercent: item.tax,
        totalCents: totals.lineTotalsCents[index] ?? 0,
        sortOrder: index,
      });
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoiceLineItem.deleteMany({ where: { invoice: { workspaceId } } });
    await tx.invoice.deleteMany({ where: { workspaceId } });
    await tx.client.deleteMany({ where: { workspaceId } });
    await tx.setting.deleteMany({ where: { workspaceId } });
    await tx.company.deleteMany({ where: { workspaceId } });

    if (file.settings) {
      await tx.setting.create({ data: { ...file.settings, workspaceId } });
    }
    if (file.company) {
      await tx.company.create({ data: { ...file.company, workspaceId } });
    }

    for (const batch of batches(clientRows, CLIENT_BATCH)) {
      await tx.client.createMany({ data: batch });
    }
    for (const batch of batches(invoiceRows, INVOICE_BATCH)) {
      await tx.invoice.createMany({ data: batch });
    }
    for (const batch of batches(lineItemRows, LINE_ITEM_BATCH)) {
      await tx.invoiceLineItem.createMany({ data: batch });
    }
  }, TRANSACTION_OPTIONS);
}
