import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.userId) return null;
  return session.userId;
}

export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect("/auth/signin");
  return userId;
}

export async function getCurrentUser() {
  const userId = await getUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/signin");
  if (user.role !== "admin") redirect("/invoices");
  return user;
}
