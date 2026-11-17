import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId } from "@/lib/workspace";
import { LIMITS, guardMutation } from "@/lib/request-guard";

/** Records "I still have my key", which quiets the dashboard nudge. */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.profileWrite);
  if (blocked) return blocked;

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  try {
    const verifiedAt = new Date();
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { recoveryKeyVerifiedAt: verifiedAt },
    });
    return NextResponse.json({ verifiedAt: verifiedAt.toISOString() });
  } catch (error) {
    console.error("Key verification failed:", error);
    return NextResponse.json({ error: "Could not record that" }, { status: 500 });
  }
}
