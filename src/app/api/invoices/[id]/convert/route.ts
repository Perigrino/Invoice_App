import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId } from "@/lib/workspace";
import { LIMITS, guardMutation } from "@/lib/request-guard";
import { nextInvoiceNumber } from "@/lib/numbering";
import { serializeInvoice } from "@/lib/invoice-mapping";

/**
 * Turns a proforma into a real invoice. Non-destructive: the proforma stays as
 * it was, and the invoice is a new row with its own number, because the
 * proforma was already sent to the client under that reference.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = await guardMutation(request, LIMITS.invoiceCreate);
  if (blocked) return blocked;

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  const { id } = await params;

  try {
    const source = await prisma.invoice.findFirst({
      where: { id, workspaceId },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    if (!source) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    if (source.invoiceType !== "proforma") {
      return NextResponse.json(
        { error: "Only a proforma can be converted." },
        { status: 400 }
      );
    }

    const issueDate = new Date();
    const dueDate = source.dueDate ?? new Date(Date.now() + 30 * 86_400_000);
    const existing = await prisma.invoice.findMany({
      where: { workspaceId },
      select: { invoiceNumber: true },
    });

    const invoice = await prisma.invoice.create({
      data: {
        workspaceId,
        invoiceNumber: nextInvoiceNumber(
          existing.map((row) => row.invoiceNumber),
          issueDate
        ),
        invoiceType: "invoice",
        clientId: source.clientId,
        status: "pending",
        subtotalCents: source.subtotalCents,
        discountPercent: source.discountPercent,
        discountCents: source.discountCents,
        taxPercent: source.taxPercent,
        taxCents: source.taxCents,
        totalCents: source.totalCents,
        balanceDueCents: source.totalCents,
        notes: source.notes,
        issueDate,
        dueDate,
        lineItems: {
          create: source.lineItems.map((line) => ({
            description: line.description,
            priceCents: line.priceCents,
            quantity: line.quantity,
            discountPercent: line.discountPercent,
            taxPercent: line.taxPercent,
            totalCents: line.totalCents,
            sortOrder: line.sortOrder,
          })),
        },
      },
      include: { client: true, lineItems: true },
    });

    return NextResponse.json(serializeInvoice(invoice));
  } catch (error) {
    console.error("Proforma conversion failed:", error);
    return NextResponse.json({ error: "Could not convert this proforma" }, { status: 500 });
  }
}
