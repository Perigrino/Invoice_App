import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function storeToken(
  identifier: string,
  token: string,
  ttlMs = 60 * 60 * 1000
): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: tokenHash,
      expires: new Date(Date.now() + ttlMs),
    },
  });
}

export async function verifyToken(identifier: string, token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier, token: tokenHash } },
  });
  if (!record) return false;
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier, token: tokenHash } },
    });
    return false;
  }
  return true;
}

export async function revokeTokens(identifier: string): Promise<void> {
  await prisma.verificationToken.deleteMany({ where: { identifier } });
}
