import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { client: true, lineItems: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(invoices);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: body.invoiceNumber,
        clientId: body.clientId,
        status: body.status || "draft",
        subtotal: body.subtotal || 0,
        discount: body.discount || 0,
        tax: body.tax || 0,
        total: body.total || 0,
        balanceDue: body.total || 0,
        notes: body.notes,
        issueDate: new Date(body.issueDate),
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
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
