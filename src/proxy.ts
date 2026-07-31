import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/auth/jwt";

const SESSION_COOKIE = "invoiceflow_session";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await decrypt(cookie);
  const isAuthenticated = Boolean(session?.userId);

  const isPublicRoute =
    path.startsWith("/auth") || path === "/" || path.startsWith("/_next");

  if (!isPublicRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL("/auth/signin", request.nextUrl));
  }

  if (path.startsWith("/auth") && isAuthenticated) {
    return NextResponse.redirect(new URL("/invoices", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};
