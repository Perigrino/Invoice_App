import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/client-ip";
import { consume } from "@/lib/rate-limit";
import { isRecoveryKey, normalizeRecoveryKey } from "@/lib/recovery";
import { WORKSPACE_COOKIE, WORKSPACE_COOKIE_MAX_AGE } from "@/lib/workspace-cookie";

/**
 * Adopts a workspace from its recovery key: sets the cookie for this browser
 * and sends the visitor on to their invoices. The key is a bearer secret, so
 * guesses are rate limited per IP.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const normalized = normalizeRecoveryKey(key);

  if (!isRecoveryKey(normalized)) {
    return new NextResponse("That recovery key is not valid.", { status: 404 });
  }

  const limited = await consume(`recovery:ip:${clientIp(request)}`, 20, 60);
  if (!limited.allowed) {
    return new NextResponse("Too many attempts. Try again shortly.", {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSeconds) },
    });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { recoveryKey: normalized },
    select: { id: true },
  });
  if (!workspace) {
    return new NextResponse("That recovery key does not match a workspace.", {
      status: 404,
    });
  }

  const response = NextResponse.redirect(new URL("/invoices", request.url), 303);
  response.cookies.set({
    name: WORKSPACE_COOKIE,
    value: workspace.id,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
  });
  return response;
}
