import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { WORKSPACE_COOKIE, isWorkspaceId } from "@/lib/workspace-cookie";

/**
 * The caller's workspace id, or `null` when the request carries no valid
 * cookie (see `src/proxy.ts`, which issues one). Reads only — nothing is
 * created here, so a forged-but-well-formed id can never mint a row.
 */
export async function getWorkspaceId(): Promise<string | null> {
  const value = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  return isWorkspaceId(value) ? value : null;
}

/**
 * Creates the workspace row if this is the first write from that browser.
 * Needed only on paths that insert rows referencing it; the foreign key makes
 * a missing workspace visible instead of silently orphaning data.
 */
export async function ensureWorkspace(workspaceId: string): Promise<void> {
  await prisma.workspace.upsert({
    where: { id: workspaceId },
    update: {},
    create: { id: workspaceId },
  });
}
