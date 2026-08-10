"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationLink } from "@/app/actions/auth";
import {
  emailSchema,
  passwordError,
  usernameSchema,
} from "@/lib/validations/auth";

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
  note?: string;
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

export async function createUserAction(
  prev: AdminActionResult,
  formData: FormData
): Promise<AdminActionResult> {
  await requireAdmin();

  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const sendEmail = formData.get("sendEmail") === "on";

  const usernameResult = usernameSchema.safeParse(username);
  if (!usernameResult.success) {
    return { error: usernameResult.error.issues[0]?.message };
  }
  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success) {
    return { error: emailResult.error.issues[0]?.message };
  }
  const passwordErrorMsg = passwordError(password);
  if (passwordErrorMsg) {
    return { error: passwordErrorMsg };
  }

  const [userWithEmail, userWithUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { username } }),
  ]);
  if (userWithEmail) {
    return { error: "An account with this email already exists." };
  }
  if (userWithUsername) {
    return { error: "That username is already taken." };
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      username,
      name: username,
      email,
      password: hashed,
      emailVerified: null,
    },
  });

  if (sendEmail) {
    try {
      await sendVerificationLink(email);
    } catch (error) {
      console.error("Failed to send verification email", error);
      return {
        note: "User created, but the verification email couldn't be sent. You can verify them manually below.",
      };
    }
  }

  return {};
}

export async function setUserVerifiedAction(
  userId: string,
  verified: boolean
): Promise<AdminActionResult> {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: verified ? new Date() : null },
  });
  return {};
}
