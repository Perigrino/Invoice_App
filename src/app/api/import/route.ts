import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/client-ip";
import { LIMITS, guardMutation } from "@/lib/request-guard";
import { ensureWorkspace, getWorkspaceId } from "@/lib/workspace";
import { validateExportFile } from "@/lib/exchange";
import { recalculate, toCents } from "@/lib/money";

/**
 * Replaces the workspace with an exported file. `dryRun` validates and reports
 * what would land; a real import needs `confirm: true` because it deletes what
 * is already there.
 */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.dataImport);
  if (blocked) return blocked;

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

  const created = await ensureWorkspace(workspaceId, clientIp(request));
  if (!created.ok) {
    return NextResponse.json(
      { error: "Too many new workspaces" },
      { status: 429, headers: { "Retry-After": String(created.retryAfterSeconds) } }
    );
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

      const clientIds: string[] = [];
      for (const client of file.clients) {
        const row = await tx.client.create({ data: { ...client, workspaceId } });
        clientIds.push(row.id);
      }

      for (const invoice of file.invoices) {
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

        await tx.invoice.create({
          data: {
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
            lineItems: {
              create: invoice.lineItems.map((item, index) => ({
                description: item.description,
                priceCents: toCents(item.price),
                quantity: item.quantity,
                discountPercent: item.discount,
                taxPercent: item.tax,
                totalCents: totals.lineTotalsCents[index] ?? 0,
                sortOrder: index,
              })),
            },
          },
        });
      }
    });
  } catch (error) {
    console.error("Import failed:", error);
    return NextResponse.json({ error: "Import failed; nothing was changed" }, { status: 500 });
  }

  return NextResponse.json({ imported: counts });
}
