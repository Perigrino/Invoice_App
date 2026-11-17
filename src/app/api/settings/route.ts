import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace, ensureWorkspaceDefaults, getWorkspaceId } from "@/lib/workspace";
import { clientIp } from "@/lib/client-ip";
import { LIMITS, guardMutation } from "@/lib/request-guard";

export async function GET() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  try {
    let settings = await prisma.setting.findUnique({ where: { workspaceId } });
    if (!settings) {
      // A workspace created before defaults were seeded: write them now.
      await ensureWorkspaceDefaults(workspaceId);
      settings = await prisma.setting.findUnique({ where: { workspaceId } });
    }
    return NextResponse.json(settings || {});
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
