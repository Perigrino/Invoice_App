import { NextResponse } from "next/server";
import { LIMITS, guardMutation } from "@/lib/request-guard";
import { getWorkspaceId } from "@/lib/workspace";
import { restoreSnapshot } from "@/lib/snapshots";

/**
 * Restores a backup over the workspace. Destructive, so it needs an explicit
 * `confirm`, exactly like an import — and it goes through the same code.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await guardMutation(request, LIMITS.snapshotRestore);
  if (blocked) return blocked;

  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if ((body as { confirm?: boolean } | null)?.confirm !== true) {
    return NextResponse.json(
      { error: "Restoring replaces everything in this workspace; pass confirm: true" },
      { status: 400 }
    );
  }

  try {
    const restored = await restoreSnapshot(workspaceId, id);
    if (!restored) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ restored: true });
  } catch (error) {
    console.error("Restore failed:", error);
    return NextResponse.json({ error: "Restore failed; nothing was changed" }, { status: 500 });
  }
}
