import { NextResponse } from "next/server";
import { clientIp } from "@/lib/client-ip";
import { LIMITS, guardMutation } from "@/lib/request-guard";
import { ensureWorkspace, getWorkspaceId } from "@/lib/workspace";
import { createSnapshot, listSnapshots } from "@/lib/snapshots";

/** The workspace's backups, newest first. */
export async function GET() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  return NextResponse.json(
    { snapshots: await listSnapshots(workspaceId) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** "Back up now": captures the current workspace. */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.snapshotCreate);
  if (blocked) return blocked;

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  const created = await ensureWorkspace(workspaceId, clientIp(request));
  if (!created.ok) {
    return NextResponse.json(
      { error: "Too many new workspaces" },
      { status: 429, headers: { "Retry-After": String(created.retryAfterSeconds) } }
    );
  }

  try {
    return NextResponse.json({ snapshot: await createSnapshot(workspaceId) });
  } catch (error) {
    console.error("Snapshot failed:", error);
    return NextResponse.json({ error: "Could not create a backup" }, { status: 500 });
  }
}
