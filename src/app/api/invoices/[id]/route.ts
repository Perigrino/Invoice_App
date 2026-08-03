import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/user";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, userId },
      include: { client: true, lineItems: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json(invoice);
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
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = await request.json();
    let clientId: string | null = body.clientId || null;
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId },
        select: { id: true },
      });
      if (!client) clientId = null;
    }
    const existing = await prisma.invoice.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        invoiceNumber: body.invoiceNumber,
        invoiceType: body.invoiceType || "invoice",
        clientId,
        status: body.status || "draft",
        subtotal: body.subtotal || 0,
        discount: body.discount || 0,
        tax: body.tax || 0,
        total: body.total || 0,
        balanceDue: body.total || 0,
        notes: body.notes,
        issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        lineItems: {
          create: (body.lineItems || []).map(
            (item: { description: string; price: number; quantity: number; discount: number; tax: number; total: number }, index: number) => ({
              description: item.description,
              price: item.price,
              quantity: item.quantity,
              discount: item.discount || 0,
              tax: item.tax || 0,
              total: item.total,
              sortOrder: index,
            })
          ),
        },
      },
      include: { client: true, lineItems: true },
    });
    return NextResponse.json(invoice);
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
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const existing = await prisma.invoice.findFirst({
      where: { id, userId },
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
