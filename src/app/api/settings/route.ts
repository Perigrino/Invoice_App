import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace, getWorkspaceId } from "@/lib/workspace";

export async function GET() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  try {
    const settings = await prisma.setting.findUnique({
      where: { workspaceId },
    });
    return NextResponse.json(settings || {});
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  try {
    await ensureWorkspace(workspaceId);
    const body = await request.json();
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
