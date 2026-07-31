"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export type AuthState = {
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
  message?: string;
};

const SignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").trim(),
  email: z.string().email("Please enter a valid email.").trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
});

const SigninSchema = z.object({
  email: z.string().email("Please enter a valid email.").trim(),
  password: z.string().min(1, "Password is required."),
});

export async function signup(
  _prevState: AuthState | undefined,
  formData: FormData
): Promise<AuthState> {
  const validatedFields = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, email, password } = validatedFields.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      errors: { email: ["An account with this email already exists."] },
    };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const userCount = await prisma.user.count();
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const role =
      userCount === 0 || adminEmails.includes(email.toLowerCase())
        ? "admin"
        : "user";

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role },
    });
    await createSession(user.id);
  } catch {
    return { message: "An error occurred while creating your account." };
  }

  redirect("/invoices");
}

export async function login(
  _prevState: AuthState | undefined,
  formData: FormData
): Promise<AuthState> {
  const validatedFields = SigninSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { email, password } = validatedFields.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.password) {
    return { message: "Invalid email or password." };
  }

  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    return { message: "Invalid email or password." };
  }

  await createSession(user.id);
  redirect("/invoices");
}

export async function logout() {
  await deleteSession();
  redirect("/auth/signin");
}
