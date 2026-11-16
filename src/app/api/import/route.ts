import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/client-ip";
import { LIMITS, guardMutation, guardRateLimit } from "@/lib/request-guard";
import { ensureWorkspace, getWorkspaceId } from "@/lib/workspace";
import { validateExportFile } from "@/lib/exchange";
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
 * Replaces the workspace with an exported file. `dryRun` validates and reports
 * what would land; a real import needs `confirm: true` because it deletes what
 * is already there.
 *
 * Two budgets, deliberately separate: every request pays into the cheap
 * `dataImportCheck` budget, and only the destructive one pays into
 * `dataImport`, so a dry run followed by a confirm (and a retry after a
 * mistake) does not exhaust the hourly import allowance.
 */
export async function POST(request: Request) {
  const preflight = await guardMutation(request, LIMITS.dataImportCheck);
  if (preflight) return preflight;

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const payload = (body as { file?: unknown; export?: unknown });
  const validation = validateExportFile(payload.file ?? payload.export ?? body);
  if (!validation.ok) {
    return NextResponse.json({ error: "Invalid export file", issues: validation.errors }, { status: 400 });
  }

  const { file, counts } = validation;

  if ((body as { dryRun?: boolean }).dryRun) {
    return NextResponse.json({ dryRun: true, counts });
  }

  if ((body as { confirm?: boolean }).confirm !== true) {
    return NextResponse.json(
      { error: "Import replaces everything in this workspace; pass confirm: true", counts },
      { status: 400 }
    );
  }

  const blocked = await guardRateLimit(request, LIMITS.dataImport);
  if (blocked) return blocked;

  const created = await ensureWorkspace(workspaceId, clientIp(request));
  if (!created.ok) {
    return NextResponse.json(
      { error: "Too many new workspaces" },
      { status: 429, headers: { "Retry-After": String(created.retryAfterSeconds) } }
    );
  }

  // Ids are generated here rather than read back: the whole import is then a
  // handful of `createMany` statements, so the transaction time depends on the
  // number of batches, not on a round trip per row.
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
    const inputs = invoice.lineItems.map((item) => ({
      price: item.price,
      quantity: item.quantity,
      discount: item.discount,
      tax: item.tax,
    }));
    const totals = recalculate({
      lineItems: inputs,
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

  try {
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
  } catch (error) {
    console.error("Import failed:", error);
    return NextResponse.json({ error: "Import failed; nothing was changed" }, { status: 500 });
  }

  return NextResponse.json({ imported: counts });
}
