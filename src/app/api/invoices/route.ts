import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace, getWorkspaceId } from "@/lib/workspace";
import { clientIp } from "@/lib/client-ip";
import { LIMITS, guardMutation } from "@/lib/request-guard";
import { balanceCents } from "@/lib/money";
import { nextInvoiceNumber } from "@/lib/numbering";
import { buildLineItemWrites, serializeInvoice } from "@/lib/invoice-mapping";

// The editor starts new invoices at "INV-00001"; anything all-zero counts too.
const PLACEHOLDER_NUMBER = /^INV-0+1?$/;

export async function GET() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  try {
    const invoices = await prisma.invoice.findMany({
      where: { workspaceId },
      include: { client: true, lineItems: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(invoices.map(serializeInvoice));
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.invoiceCreate);
  if (blocked) return blocked;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  try {
    const created = await ensureWorkspace(workspaceId, clientIp(request));
    if (!created.ok) {
      return NextResponse.json(
        { error: "Too many new workspaces" },
        { status: 429, headers: { "Retry-After": String(created.retryAfterSeconds) } }
      );
    }
    const body = await request.json();
    let clientId: string | null = body.clientId || null;
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, workspaceId },
        select: { id: true },
      });
      if (!client) clientId = null;
    }

    const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
    const { rows, totals } = buildLineItemWrites(body);
    const invoiceNumber = await resolveInvoiceNumber(workspaceId, body.invoiceNumber, issueDate);

    const invoice = await prisma.invoice.create({
      data: {
        workspaceId,
        invoiceNumber,
        invoiceType: body.invoiceType || "invoice",
        clientId,
        status: body.status || "draft",
        subtotalCents: totals.subtotalCents,
        discountPercent: Number(body.discount) || 0,
        discountCents: totals.discountCents,
        taxPercent: Number(body.tax) || 0,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        balanceDueCents: balanceCents(totals.totalCents),
        notes: body.notes,
        issueDate,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        lineItems: { create: rows },
      },
      include: { client: true, lineItems: true },
    });

    return NextResponse.json(serializeInvoice(invoice));
  } catch {
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}

/**
 * Numbers are assigned server-side: a blank body number, or the editor's
 * `INV-00001` placeholder, becomes the next free sequence for this workspace
 * and year.
 */
async function resolveInvoiceNumber(
  workspaceId: string,
  requested: unknown,
  issueDate: Date
): Promise<string> {
  const wanted = typeof requested === "string" ? requested.trim() : "";
  if (wanted && !PLACEHOLDER_NUMBER.test(wanted)) return wanted;

  const existing = await prisma.invoice.findMany({
    where: { workspaceId },
    select: { invoiceNumber: true },
  });
  return nextInvoiceNumber(
    existing.map((invoice) => invoice.invoiceNumber),
    issueDate
  );
}
