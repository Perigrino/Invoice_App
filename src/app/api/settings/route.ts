import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ensureWorkspace,
  ensureWorkspaceDefaults,
  getWorkspaceId,
  settingsDefaults,
} from "@/lib/workspace";
import { clientIp } from "@/lib/client-ip";
import { LIMITS, guardMutation } from "@/lib/request-guard";

export async function GET() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  try {
    const existing = await prisma.setting.findUnique({ where: { workspaceId } });
    if (existing) return NextResponse.json(existing);

    // No settings row. A read must not create the workspace (nothing has been
    // written in this browser yet), so answer with the same defaults the row
    // would carry instead of failing on the foreign key.
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!workspace) {
      return NextResponse.json(settingsDefaults(), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // A workspace older than the seeding: write its defaults now.
    await ensureWorkspaceDefaults(workspaceId);
    const seeded = await prisma.setting.findUnique({ where: { workspaceId } });
    return NextResponse.json(seeded || settingsDefaults());
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch settings" },
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

    // The logo travels as a base64 data URI, so it has its own, tighter cap.
    if (typeof body.logo === "string" && body.logo.length > 800_000) {
      return NextResponse.json({ error: "Logo too large" }, { status: 413 });
    }
    if (typeof body.logo === "string" && body.logo && !body.logo.startsWith("data:image/")) {
      return NextResponse.json({ error: "Logo must be an image" }, { status: 400 });
    }
    const existing = await prisma.setting.findUnique({ where: { workspaceId } });
    if (existing) {
      const settings = await prisma.setting.update({
        where: { workspaceId },
        data: body,
      });
      return NextResponse.json(settings);
    } else {
      const settings = await prisma.setting.create({
        data: { workspaceId, ...body },
      });
      return NextResponse.json(settings);
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
