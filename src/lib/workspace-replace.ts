import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ExportFile } from "@/lib/exchange";
import { recalculate, toCents } from "@/lib/money";

/**
 * Postgres caps a statement at 65,535 parameters. The widest row here is an
 * invoice at 15 columns, so 500 rows is under 8,000 parameters — comfortably
 * safe for all three tables, and large enough that a 20,000-invoice file is a
 * few dozen statements.
 */
const BATCH_SIZE = 500;

/** The default 5s is too short once the database is not on localhost. */
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
        discountPercent: item.discountPercent,
        taxPercent: item.taxPercent,
      })),
      discountPercent: invoice.discountPercent,
      taxPercent: invoice.taxPercent,
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
      discountPercent: invoice.discountPercent,
      discountCents: totals.discountCents,
      taxPercent: invoice.taxPercent,
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
        discountPercent: item.discountPercent,
        taxPercent: item.taxPercent,
        totalCents: totals.lineTotalsCents[index] ?? 0,
        sortOrder: index,
      });
    });
  }

  await prisma.$transaction(async (tx) => {
    // Line items go with their invoices (onDelete: Cascade), so they need no
    // delete of their own; everything here commits or rolls back together.
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

    for (const batch of batches(clientRows, BATCH_SIZE)) {
      await tx.client.createMany({ data: batch });
    }
    for (const batch of batches(invoiceRows, BATCH_SIZE)) {
      await tx.invoice.createMany({ data: batch });
    }
    for (const batch of batches(lineItemRows, BATCH_SIZE)) {
      await tx.invoiceLineItem.createMany({ data: batch });
    }
  }, TRANSACTION_OPTIONS);
}
