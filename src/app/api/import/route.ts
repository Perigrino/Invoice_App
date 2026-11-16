import { NextResponse } from "next/server";
import { clientIp } from "@/lib/client-ip";
import { LIMITS, guardMutation, guardRateLimit } from "@/lib/request-guard";
import { ensureWorkspace, getWorkspaceId } from "@/lib/workspace";
import { validateExportFile } from "@/lib/exchange";
import { replaceWorkspace } from "@/lib/workspace-replace";

/**
 * Replaces the workspace with an exported file. `dryRun` validates and reports
 * what would land; a real import needs `confirm: true` because it deletes what
 * is already there.
 *
 * Two budgets, deliberately separate: every request pays into the cheap
 * `dataImportCheck` budget, and only the destructive one pays into
 * `dataImport`, so a dry run followed by a confirm (and a retry after a
 * mistake) does not exhaust the hourly import allowance.
 */
export async function POST(request: Request) {
  const preflight = await guardMutation(request, LIMITS.dataImportCheck);
  if (preflight) return preflight;

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // A bare export file is also accepted; the UI always posts `{ file }`.
  const validation = validateExportFile((body as { file?: unknown }).file ?? body);
  if (!validation.ok) {
    return NextResponse.json({ error: "Invalid export file", issues: validation.errors }, { status: 400 });
  }

  const { file, counts } = validation;

  if ((body as { dryRun?: boolean }).dryRun) {
    return NextResponse.json({ dryRun: true, counts });
  }

  if ((body as { confirm?: boolean }).confirm !== true) {
    return NextResponse.json(
      { error: "Import replaces everything in this workspace; pass confirm: true", counts },
      { status: 400 }
    );
  }

  const blocked = await guardRateLimit(request, LIMITS.dataImport);
  if (blocked) return blocked;

  const created = await ensureWorkspace(workspaceId, clientIp(request));
  if (!created.ok) {
    return NextResponse.json(
      { error: "Too many new workspaces" },
      { status: 429, headers: { "Retry-After": String(created.retryAfterSeconds) } }
    );
  }

  try {
    await replaceWorkspace(workspaceId, file);
  } catch (error) {
    console.error("Import failed:", error);
    return NextResponse.json({ error: "Import failed; nothing was changed" }, { status: 500 });
  }

  return NextResponse.json({ imported: counts });
}
