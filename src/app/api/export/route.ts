import { NextResponse } from "next/server";
import { getWorkspaceId } from "@/lib/workspace";
import { loadWorkspaceExport } from "@/lib/workspace-export";

/**
 * Everything in the caller's workspace as one JSON file. Without accounts this
 * is the only way to keep a copy of the data, so it must stay complete.
 */
export async function GET() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  try {
    const file = await loadWorkspaceExport(workspaceId);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(file, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="invoiceflow-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
