import { NextResponse } from "next/server";
import { LIMITS, guardMutation } from "@/lib/request-guard";
import { getWorkspaceId } from "@/lib/workspace";
import { deleteSnapshot, previewSnapshot } from "@/lib/snapshots";

type RouteContext = { params: Promise<{ id: string }> };

/** What restoring this backup would change — nothing is modified. */
export async function GET(_request: Request, { params }: RouteContext) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  const preview = await previewSnapshot(workspaceId, id);
  if (!preview) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(preview, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const blocked = await guardMutation(request, LIMITS.snapshotCreate);
  if (blocked) return blocked;

  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  const deleted = await deleteSnapshot(workspaceId, id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ deleted: true });
}
