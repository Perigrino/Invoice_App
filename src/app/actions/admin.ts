"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (actor?.role !== "admin") redirect("/invoices");

  return userId;
}

export interface AdminActionResult {
  error?: string;
}

export async function updateRoleAction(
  userId: string,
  role: string
): Promise<AdminActionResult> {
  const actorId = await requireAdmin();
  if (role !== "admin" && role !== "user") {
    return { error: "Invalid role." };
  }
  if (userId === actorId) {
    return { error: "You can't change your own role." };
  }
  await prisma.user.update({ where: { id: userId }, data: { role } });
  return {};
}

export async function deleteUserAction(
  userId: string
): Promise<AdminActionResult> {
  const actorId = await requireAdmin();
  if (userId === actorId) {
    return { error: "You can't delete your own account." };
  }
  await prisma.user.delete({ where: { id: userId } });
  return {};
}
