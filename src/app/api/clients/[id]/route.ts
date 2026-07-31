import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth/dal";

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
    const client = await prisma.client.findFirst({
      where: { id, userId },
      include: {
        _count: { select: { invoices: true } },
      },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    return NextResponse.json(client);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch client" },
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
    const existing = await prisma.client.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    const client = await prisma.client.update({
      where: { id },
      data: {
        fullName: body.fullName,
        company: body.company,
        email: body.email,
        phone: body.phone,
        address: body.address,
        taxId: body.taxId,
      },
    });
    return NextResponse.json(client);
  } catch {
    return NextResponse.json(
      { error: "Failed to update client" },
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
    const existing = await prisma.client.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
}
