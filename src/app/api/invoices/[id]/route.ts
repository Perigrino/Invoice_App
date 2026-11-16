import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId } from "@/lib/workspace";
import { balanceCents } from "@/lib/money";
import { buildLineItemWrites, serializeInvoice } from "@/lib/invoice-mapping";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, workspaceId },
      include: { client: true, lineItems: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json(serializeInvoice(invoice));
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const body = await request.json();
    const existing = await prisma.invoice.findFirst({
      where: { id, workspaceId },
      select: { id: true, invoiceNumber: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    let clientId: string | null = body.clientId || null;
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, workspaceId },
        select: { id: true },
      });
      if (!client) clientId = null;
    }

    const { rows, totals } = buildLineItemWrites(body);
    const invoiceNumber =
      typeof body.invoiceNumber === "string" && body.invoiceNumber.trim()
        ? body.invoiceNumber.trim()
        : existing.invoiceNumber;

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
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
        issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        lineItems: {
          deleteMany: {},
          create: rows,
        },
      },
      include: { client: true, lineItems: true },
    });

    return NextResponse.json(serializeInvoice(invoice));
  } catch {
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const existing = await prisma.invoice.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    await prisma.invoice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
