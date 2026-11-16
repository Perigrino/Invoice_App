import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShareToken, shareUrl } from "@/lib/share";
import { getWorkspaceId } from "@/lib/workspace";
import { LIMITS, guardMutation } from "@/lib/request-guard";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function ownedInvoice(workspaceId: string, id: string) {
  return prisma.invoice.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      shareToken: true,
      shareCreatedAt: true,
      shareRevokedAt: true,
      shareViews: true,
      shareLastViewedAt: true,
    },
  });
}

function serialize(invoice: {
  shareToken: string | null;
  shareCreatedAt: Date | null;
  shareRevokedAt: Date | null;
  shareViews: number;
  shareLastViewedAt: Date | null;
}, origin: string) {
  return {
    shared: Boolean(invoice.shareToken),
    url: invoice.shareToken ? shareUrl(origin, invoice.shareToken) : null,
    createdAt: invoice.shareCreatedAt?.toISOString() ?? null,
    revokedAt: invoice.shareRevokedAt?.toISOString() ?? null,
    views: invoice.shareViews,
    lastViewedAt: invoice.shareLastViewedAt?.toISOString() ?? null,
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const invoice = await ownedInvoice(workspaceId, id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(serialize(invoice, new URL(request.url).origin), {
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Creates the link, or rotates it when one already exists — rotating is how a
 * leaked link is replaced without leaving the old one alive.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const guard = await guardMutation(request, LIMITS.shareWrite);
  if (guard) return guard;

  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const existing = await ownedInvoice(workspaceId, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const invoice = await prisma.invoice.update({
        where: { id: existing.id },
        data: {
          shareToken: generateShareToken(),
          shareCreatedAt: new Date(),
          shareRevokedAt: null,
          shareViews: 0,
          shareLastViewedAt: null,
        },
        select: {
          shareToken: true,
          shareCreatedAt: true,
          shareRevokedAt: true,
          shareViews: true,
          shareLastViewedAt: true,
        },
      });
      return NextResponse.json(serialize(invoice, new URL(request.url).origin));
    } catch {
      // Token collision: practically impossible, but cheap to retry.
    }
  }

  return NextResponse.json({ error: "Could not create link" }, { status: 500 });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const guard = await guardMutation(request, LIMITS.shareWrite);
  if (guard) return guard;

  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const existing = await ownedInvoice(workspaceId, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const invoice = await prisma.invoice.update({
    where: { id: existing.id },
    data: { shareToken: null, shareRevokedAt: new Date() },
    select: {
      shareToken: true,
      shareCreatedAt: true,
      shareRevokedAt: true,
      shareViews: true,
      shareLastViewedAt: true,
    },
  });

  return NextResponse.json(serialize(invoice, new URL(request.url).origin));
}
