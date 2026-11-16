import { NextResponse } from "next/server";
import { getRecoveryKey, getWorkspaceId } from "@/lib/workspace";
import { formatRecoveryKey } from "@/lib/recovery";

/** The recovery key and the bookmarkable link that adopts this workspace. */
export async function GET(request: Request) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  try {
    const recoveryKey = formatRecoveryKey(await getRecoveryKey(workspaceId));
    const origin = new URL(request.url).origin;
    return NextResponse.json(
      { recoveryKey, url: `${origin}/w/${recoveryKey}` },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Workspace read failed:", error);
    return NextResponse.json({ error: "Failed to read workspace" }, { status: 500 });
  }
}
