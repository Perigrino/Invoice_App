import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  companyDefaults,
  ensureWorkspace,
  ensureWorkspaceDefaults,
  getWorkspaceId,
} from "@/lib/workspace";
import { clientIp } from "@/lib/client-ip";
import { LIMITS, guardMutation } from "@/lib/request-guard";

export async function GET() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  try {
    const existing = await prisma.company.findUnique({ where: { workspaceId } });
    if (existing) return NextResponse.json(existing);

    // A read must not create the workspace; answer with the app's defaults.
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!workspace) {
      return NextResponse.json(companyDefaults(), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // A workspace older than the seeding: write its defaults now.
    await ensureWorkspaceDefaults(workspaceId);
    const seeded = await prisma.company.findUnique({ where: { workspaceId } });
    return NextResponse.json(seeded || companyDefaults());
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch company" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const blocked = await guardMutation(request, LIMITS.profileWrite);
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

    const companyData = {
      name: body.name || body.fullName || "",
      logo: body.logo,
      address: body.address,
      email: body.email,
      phone: body.phone,
      website: body.website,
      taxId: body.taxId,
    };

    const company = await prisma.company.upsert({
      where: { workspaceId },
      update: companyData,
      create: { ...companyData, workspaceId },
    });
    return NextResponse.json(company);
  } catch {
    return NextResponse.json(
      { error: "Failed to update company" },
      { status: 500 }
    );
  }
}
