import "server-only";
import { cookies } from "next/headers";
import { encrypt, decrypt } from "@/lib/auth/jwt";

const SESSION_COOKIE = "invoiceflow_session";
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  const session = await encrypt({ userId, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  return await decrypt(cookie);
}

export { SESSION_COOKIE };
