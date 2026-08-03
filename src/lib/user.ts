import "server-only";
import { prisma } from "@/lib/prisma";

let defaultUserId: string | null = null;

export async function getUserId(): Promise<string | null> {
  try {
    if (defaultUserId) return defaultUserId;
    const first = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (first) {
      defaultUserId = first.id;
      return first.id;
    }
    const created = await prisma.user.create({
      data: { name: "Owner", email: `owner-${Date.now()}@local` },
    });
    defaultUserId = created.id;
    return created.id;
  } catch {
    return null;
  }
}