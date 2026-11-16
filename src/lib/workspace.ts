import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { consume } from "@/lib/rate-limit";
import { generateRecoveryKey } from "@/lib/recovery";
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

export type WorkspaceCreation =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

/** New workspaces allowed per IP per hour, and across the whole app per day. */
const CREATIONS_PER_IP = 3;
const CREATION_WINDOW_SECONDS = 60 * 60;
const CREATIONS_GLOBAL = 500;
const GLOBAL_WINDOW_SECONDS = 60 * 60 * 24;

/**
 * Creates the workspace row if this is the first write from that browser.
 * Needed only on paths that insert rows referencing it; the foreign key makes
 * a missing workspace visible instead of silently orphaning data.
 *
 * Because anyone can send `Cookie: invoiceflow_ws=<fresh uuid>`, creation is
 * itself rate limited — otherwise a single client could mint unlimited rows.
 */
export async function ensureWorkspace(
  workspaceId: string,
  ip: string
): Promise<WorkspaceCreation> {
  const existing = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  if (existing) return { ok: true };

  const [byIp, global] = await Promise.all([
    consume(`wscreate:ip:${ip}`, CREATIONS_PER_IP, CREATION_WINDOW_SECONDS),
    consume("wscreate:global", CREATIONS_GLOBAL, GLOBAL_WINDOW_SECONDS),
  ]);
  const blocked = [byIp, global].find((result) => !result.allowed);
  if (blocked) return { ok: false, retryAfterSeconds: blocked.retryAfterSeconds };

  try {
    await prisma.workspace.create({
      data: { id: workspaceId, recoveryKey: generateRecoveryKey() },
    });
  } catch {
    // A concurrent request created it first; that is success for this caller.
    const raced = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!raced) return { ok: false, retryAfterSeconds: CREATION_WINDOW_SECONDS };
  }

  return { ok: true };
}

/**
 * The workspace's recovery key, created on first use — including for a
 * workspace row that does not exist yet, because a reader can arrive before
 * the first write. An existing key is never replaced.
 */
export async function getRecoveryKey(workspaceId: string): Promise<string> {
  const existing = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { recoveryKey: true },
  });
  if (existing?.recoveryKey) return existing.recoveryKey;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const recoveryKey = generateRecoveryKey();
    try {
      if (existing) {
        // A row from before keys shipped: fill in the missing one.
        await prisma.workspace.update({ where: { id: workspaceId }, data: { recoveryKey } });
      } else {
        await prisma.workspace.create({ data: { id: workspaceId, recoveryKey } });
      }
      return recoveryKey;
    } catch {
      // Lost a race, or the key clashed: keep whichever key now exists.
      const current = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { recoveryKey: true },
      });
      if (current?.recoveryKey) return current.recoveryKey;
    }
  }

  throw new Error("Could not create a recovery key");
}
