import { NextResponse, type NextRequest } from "next/server";
import {
  WORKSPACE_COOKIE,
  WORKSPACE_COOKIE_MAX_AGE,
  isWorkspaceId,
  newWorkspaceId,
} from "@/lib/workspace-cookie";

/**
 * Issues the anonymous workspace cookie. There is no sign-in on this app, so
 * the first request a browser makes mints an id and everything that browser
 * creates afterwards is filed under it. A missing or malformed cookie is
 * replaced, which is also how a tampered value heals itself.
 *
 * The proxy only manages the cookie; it never decides access. Scoping happens
 * in server code, where every query is filtered by this id.
 */
export function proxy(request: NextRequest) {
  const existing = request.cookies.get(WORKSPACE_COOKIE)?.value;
  if (isWorkspaceId(existing)) return NextResponse.next();

  // The browser only stores the cookie for its *next* request, so the current
  // one is forwarded with the new id appended. Without this, a write arriving
  // before any page load (a first-request POST) would have no workspace.
  const id = newWorkspaceId();
  const headers = new Headers(request.headers);
  const existingCookieHeader = request.headers.get("cookie");
  headers.set(
    "cookie",
    existingCookieHeader
      ? `${existingCookieHeader}; ${WORKSPACE_COOKIE}=${id}`
      : `${WORKSPACE_COOKIE}=${id}`
  );

  const response = NextResponse.next({ request: { headers } });
  response.cookies.set({
    name: WORKSPACE_COOKIE,
    value: id,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
  });
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, the image optimiser and the favicon.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)",
  ],
};
