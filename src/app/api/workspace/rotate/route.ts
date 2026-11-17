import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId } from "@/lib/workspace";
import { formatRecoveryKey, generateRecoveryKey } from "@/lib/recovery";
import { LIMITS, guardMutation } from "@/lib/request-guard";

/**
 * Replaces the recovery key. The old key stops working immediately — that is
 * the point: a key that leaked (a screenshot, an email, a shared note) cannot
 * otherwise be taken out of circulation.
 */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.profileWrite);
  if (blocked) return blocked;

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const recoveryKey = generateRecoveryKey();
      try {
        const workspace = await prisma.workspace.update({
          where: { id: workspaceId },
          data: { recoveryKey, recoveryKeyVerifiedAt: new Date() },
          select: { recoveryKey: true },
        });
        const formatted = formatRecoveryKey(workspace.recoveryKey ?? recoveryKey);
        const origin = new URL(request.url).origin;
        return NextResponse.json(
          { recoveryKey: formatted, url: `${origin}/w/${formatted}` },
          { headers: { "Cache-Control": "no-store" } }
        );
      } catch {
        // Key collision, or the row is gone: try again, then give up.
      }
    }
    return NextResponse.json({ error: "Could not rotate the key" }, { status: 500 });
  } catch (error) {
    console.error("Recovery key rotation failed:", error);
    return NextResponse.json({ error: "Could not rotate the key" }, { status: 500 });
  }
}
