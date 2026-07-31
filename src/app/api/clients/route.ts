import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth/dal";

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const clients = await prisma.client.findMany({
      where: { userId },
      include: {
        _count: { select: { invoices: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(clients);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const client = await prisma.client.create({
      data: {
        userId,
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
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
