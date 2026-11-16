import "server-only";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * The cookie that identifies an anonymous workspace. There are no accounts on
 * this app: the browser is handed one of these on its first request (see
 * `src/proxy.ts`) and every row it creates is filed under that value.
 */
export const WORKSPACE_COOKIE = "invoiceflow_ws";

/** Header the proxy uses to hand the resolved id to server code. */
export const WORKSPACE_HEADER = "x-workspace-id";

/**
 * Resolves the caller's workspace, creating the row on first use so foreign
 * keys never point at a missing workspace. Returns `null` only if the proxy did
 * not run for this request (which would be a configuration bug, not a user
 * error).
 */
export async function getWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const id = fromCookie ?? (await headers()).get(WORKSPACE_HEADER);
  if (!id) return null;

  await prisma.workspace.upsert({
    where: { id },
    update: {},
    create: { id },
  });

  return id;
}
