import "server-only";
import { NextResponse } from "next/server";
import { clientIp } from "@/lib/client-ip";
import { consume, pruneRateLimits } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/same-origin";
import { getWorkspaceId } from "@/lib/workspace";

/**
 * Per-route limits for mutations. `perWorkspace` protects one browser from
 * itself (and from a script in its own origin); `perIp` protects the service
 * from a client that keeps minting fresh cookies.
 */
export interface MutationLimits {
  name: string;
  perWorkspace: number;
  perIp: number;
  windowSeconds: number;
  /** Largest accepted body, in bytes. Also enforced by the proxy buffer cap. */
  maxBytes: number;
}

export const LIMITS = {
  invoiceCreate: { name: "invoice:create", perWorkspace: 60, perIp: 120, windowSeconds: 60, maxBytes: 256 * 1024 },
  invoiceUpdate: { name: "invoice:update", perWorkspace: 120, perIp: 240, windowSeconds: 60, maxBytes: 256 * 1024 },
  clientWrite: { name: "client:write", perWorkspace: 60, perIp: 120, windowSeconds: 60, maxBytes: 256 * 1024 },
  profileWrite: { name: "profile:write", perWorkspace: 30, perIp: 60, windowSeconds: 60, maxBytes: 2 * 1024 * 1024 },
  pdfExport: { name: "pdf:export", perWorkspace: 20, perIp: 40, windowSeconds: 60, maxBytes: 512 * 1024 },
  shareWrite: { name: "share:write", perWorkspace: 20, perIp: 40, windowSeconds: 60, maxBytes: 1024 },
  /**
   * Every import request, dry runs included: parsing and validating a 4 MB file
   * is real work, but it must not spend the budget that only the destructive,
   * actual import should have.
   */
  dataImportCheck: { name: "data:import-check", perWorkspace: 30, perIp: 60, windowSeconds: 3600, maxBytes: 4 * 1024 * 1024 },
  dataImport: { name: "data:import", perWorkspace: 3, perIp: 6, windowSeconds: 3600, maxBytes: 4 * 1024 * 1024 },
  snapshotCreate: { name: "snapshot:create", perWorkspace: 6, perIp: 12, windowSeconds: 3600, maxBytes: 1024 },
  snapshotRestore: { name: "snapshot:restore", perWorkspace: 6, perIp: 12, windowSeconds: 3600, maxBytes: 1024 },
} satisfies Record<string, MutationLimits>;

/**
 * Rejects cross-origin requests and oversized payloads before the body is
 * read. Returns `null` when the request may proceed.
 */
function guardShape(
  request: Request,
  limits: MutationLimits
): NextResponse | null {
  if (
    !isSameOriginMutation({
      origin: request.headers.get("origin"),
      host: request.headers.get("host"),
      secFetchSite: request.headers.get("sec-fetch-site"),
    })
  ) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > limits.maxBytes) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  return null;
}

/**
 * Spends one request from the caller's budget, without the shape check. Only
 * routes that must read the body to know which budget applies use this (the
 * import route: a dry run is cheap, a real import is not).
 */
export async function guardRateLimit(
  request: Request,
  limits: MutationLimits
): Promise<NextResponse | null> {
  const workspaceId = await getWorkspaceId();
  const ip = clientIp(request);

  const [workspaceResult, ipResult] = await Promise.all([
    workspaceId
      ? consume(`ws:${workspaceId}:${limits.name}`, limits.perWorkspace, limits.windowSeconds)
      : Promise.resolve(null),
    consume(`ip:${ip}:${limits.name}`, limits.perIp, limits.windowSeconds),
  ]);

  void pruneRateLimits();

  const blocked = [workspaceResult, ipResult].find((result) => result && !result.allowed);
  if (blocked) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(blocked.retryAfterSeconds),
          "X-RateLimit-Limit": String(blocked.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null;
}

/**
 * The normal entry point for a mutating route, called before the body is read:
 * rejects cross-origin requests, oversized payloads and callers over budget.
 * Returns `null` when the request may proceed.
 */
export async function guardMutation(
  request: Request,
  limits: MutationLimits
): Promise<NextResponse | null> {
  const shape = guardShape(request, limits);
  if (shape) return shape;
  return guardRateLimit(request, limits);
}
