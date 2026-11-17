import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getRecoveryKey, getWorkspaceId } from "@/lib/workspace";
import { formatRecoveryKey, parseRecoveryKey } from "@/lib/recovery";
import { LIMITS, guardMutation } from "@/lib/request-guard";
import { WORKSPACE_COOKIE } from "@/lib/workspace-cookie";

/** How long a confirmed key is trusted before the dashboard asks again. */
const VERIFY_AFTER_DAYS = 30;

function urlFor(origin: string, recoveryKey: string) {
  return `${origin}/w/${recoveryKey}`;
}

/**
 * The recovery key and the bookmarkable link that adopts this workspace, plus
 * whether this is a good moment to ask the holder to confirm they still have
 * the key — the only way back in, and easy to lose.
 */
export async function GET(request: Request) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  try {
    const recoveryKey = formatRecoveryKey(await getRecoveryKey(workspaceId));
    const [invoices, workspace] = await Promise.all([
      prisma.invoice.count({ where: { workspaceId } }),
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { recoveryKeyVerifiedAt: true },
      }),
    ]);

    const verifiedAt = workspace?.recoveryKeyVerifiedAt ?? null;
    const stale =
      !verifiedAt ||
      Date.now() - verifiedAt.getTime() > VERIFY_AFTER_DAYS * 86_400_000;

    const origin = new URL(request.url).origin;
    return NextResponse.json(
      {
        recoveryKey,
        url: urlFor(origin, recoveryKey),
        needsKeyCheck: invoices > 0 && stale,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Workspace read failed:", error);
    return NextResponse.json({ error: "Failed to read workspace" }, { status: 500 });
  }
}

/**
 * Deletes this workspace and everything filed under it. Guarded by the
 * recovery key rather than a confirmation flag, so a stray request (or a
 * mis-click in a script) cannot empty a browser of its invoices.
 */
export async function DELETE(request: NextRequest) {
  const blocked = await guardMutation(request, LIMITS.profileWrite);
  if (blocked) return blocked;

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const key = parseRecoveryKey(String(body.key ?? ""));
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { recoveryKey: true },
  });

  if (!workspace || !key || workspace.recoveryKey !== key) {
    return NextResponse.json(
      { error: "That key does not match this workspace." },
      { status: 403 }
    );
  }

  try {
    await prisma.workspace.delete({ where: { id: workspaceId } });
    (await cookies()).delete(WORKSPACE_COOKIE);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Workspace delete failed:", error);
    return NextResponse.json({ error: "Could not delete this workspace" }, { status: 500 });
  }
}
