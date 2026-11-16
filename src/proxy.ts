import { NextResponse, type NextRequest } from "next/server";

const WORKSPACE_COOKIE = "invoiceflow_ws";
const WORKSPACE_HEADER = "x-workspace-id";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Issues the anonymous workspace cookie. There is no sign-in on this app, so
 * the first request a browser makes mints an id and everything that browser
 * creates afterwards is filed under it.
 *
 * Must stay dependency-free: the proxy runs before (and separately from) the
 * app, so no Prisma or `server-only` imports belong in this file.
 */
export function proxy(request: NextRequest) {
  const existing = request.cookies.get(WORKSPACE_COOKIE)?.value;
  const workspaceId = existing ?? crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(WORKSPACE_HEADER, workspaceId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!existing) {
    response.cookies.set({
      name: WORKSPACE_COOKIE,
      value: workspaceId,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONE_YEAR,
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, the image optimiser and the favicon.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)",
  ],
};
