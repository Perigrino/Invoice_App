import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace, getWorkspaceId } from "@/lib/workspace";
import { LIMITS, guardMutation } from "@/lib/request-guard";

export async function GET() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  try {
    const clients = await prisma.client.findMany({
      where: { workspaceId },
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
  const blocked = await guardMutation(request, LIMITS.clientWrite);
  if (blocked) return blocked;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  try {
    await ensureWorkspace(workspaceId);
    const body = await request.json();
    const client = await prisma.client.create({
      data: {
        workspaceId,
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
