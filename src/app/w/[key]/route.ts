import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/client-ip";
import { consume } from "@/lib/rate-limit";
import { formatRecoveryKey, parseRecoveryKey } from "@/lib/recovery";
import { isSameOriginMutation } from "@/lib/same-origin";
import { getWorkspaceId } from "@/lib/workspace";
import { WORKSPACE_COOKIE, WORKSPACE_COOKIE_MAX_AGE } from "@/lib/workspace-cookie";

/**
 * Adopts a workspace from its recovery key: sets the cookie for this browser
 * and sends the visitor on to their invoices. The key is a bearer secret, so
 * guesses are rate limited per IP.
 *
 * Adoption deliberately does not happen blindly. A `GET` carries an ambient
 * cookie and can be triggered by any page on the web (an image tag is enough),
 * so the cookie is only written when the visitor is alone in this browser
 * (no existing workspace with data) and the navigation did not come from
 * another site. Otherwise the visitor confirms on a same-origin `POST`, which
 * cannot be forged cross-site.
 */

type RouteContext = { params: Promise<{ key: string }> };

type Lookup = { ok: true; workspaceId: string } | { ok: false; response: NextResponse };

function textResponse(message: string, status: number): NextResponse {
  return new NextResponse(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function resolveKey(request: NextRequest, rawKey: string): Promise<Lookup> {
  const key = parseRecoveryKey(rawKey);
  if (!key) return { ok: false, response: textResponse("That recovery key is not valid.", 404) };

  const limited = await consume(`recovery:ip:${clientIp(request)}`, 20, 60);
  if (!limited.allowed) {
    return {
      ok: false,
      response: new NextResponse("Too many attempts. Try again shortly.", {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds), "Cache-Control": "no-store" },
      }),
    };
  }

  const workspace = await prisma.workspace.findUnique({
    where: { recoveryKey: key },
    select: { id: true },
  });
  if (!workspace) {
    return { ok: false, response: textResponse("That recovery key does not match a workspace.", 404) };
  }

  return { ok: true, workspaceId: workspace.id };
}

/**
 * True when adopting would either switch someone out of a workspace they are
 * using, or could be triggered by a page they did not come from.
 */
async function needsConfirmation(request: NextRequest, targetId: string): Promise<boolean> {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return true;

  const current = await getWorkspaceId();
  if (!current || current === targetId) return false;

  // An empty workspace has nothing to leave behind, which is the normal case
  // for a fresh browser opening a bookmark.
  const invoices = await prisma.invoice.count({ where: { workspaceId: current } });
  return invoices > 0;
}

function adopt(workspaceId: string, requestUrl: string): NextResponse {
  const response = NextResponse.redirect(new URL("/invoices", requestUrl), 303);
  response.cookies.set({
    name: WORKSPACE_COOKIE,
    value: workspaceId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
  });
  return response;
}

function confirmationPage(rawKey: string): NextResponse {
  const key = formatRecoveryKey(rawKey);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Open workspace ${key}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f9fafb; color: #111827; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
      main { max-width: 26rem; padding: 2rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05); }
      h1 { font-size: 1.125rem; margin: 0 0 0.5rem; }
      p { font-size: 0.875rem; line-height: 1.5; color: #4b5563; margin: 0 0 1rem; }
      code { display: block; text-align: center; padding: 0.75rem; margin: 0 0 1.25rem; background: #f3f4f6; border-radius: 0.5rem; font-family: ui-monospace, monospace; font-size: 1rem; letter-spacing: 0.05em; color: #111827; }
      .row { display: flex; gap: 0.5rem; justify-content: flex-end; }
      button { padding: 0.5rem 0.875rem; border-radius: 0.5rem; border: 0; background: #059669; color: #fff; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
      a { padding: 0.5rem 0.875rem; border-radius: 0.5rem; color: #4b5563; font-size: 0.875rem; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <h1>Open this workspace?</h1>
      <p>This browser is using a workspace with invoices in it. Opening this key switches it to a different workspace — your current invoices stay where they are, but this browser will stop showing them.</p>
      <code>${key}</code>
      <form method="post" class="row">
        <a href="/invoices">Cancel</a>
        <button type="submit">Switch workspace</button>
      </form>
    </main>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { key } = await params;
  const lookup = await resolveKey(request, key);
  if (!lookup.ok) return lookup.response;

  if (await needsConfirmation(request, lookup.workspaceId)) return confirmationPage(key);
  return adopt(lookup.workspaceId, request.url);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { key } = await params;

  const sameOrigin = isSameOriginMutation({
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  });
  if (!sameOrigin) return textResponse("Cross-origin request rejected", 403);

  const lookup = await resolveKey(request, key);
  if (!lookup.ok) return lookup.response;

  return adopt(lookup.workspaceId, request.url);
}
