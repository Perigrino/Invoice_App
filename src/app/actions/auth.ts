"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateToken, revokeTokens, storeToken, verifyToken } from "@/lib/tokens";
import { buildUrl, getBaseUrl } from "@/lib/url";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import {
  emailSchema,
  passwordError,
  usernameSchema,
} from "@/lib/validations/auth";

export interface AuthFormState {
  error?: string;
  success?: string;
  needsVerification?: boolean;
  email?: string;
}

async function sendVerificationLink(email: string): Promise<void> {
  const token = generateToken();
  await storeToken(email, token);
  const baseUrl = await getBaseUrl();
  const url = buildUrl(baseUrl, "/verify-email", { token, email });
  try {
    await sendVerificationEmail(email, url);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[dev] Verification link for ${email}: ${url}`);
      return;
    }
    throw error;
  }
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerified) {
    return {
      error: "Please verify your email before signing in.",
      needsVerification: true,
    };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/invoices" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

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

  try {
    await sendVerificationLink(email);
  } catch (error) {
    console.error("Failed to send verification email", error);
    return {
      success:
        "Your account was created, but we couldn't send the verification email. Sign in to request a new link.",
      email,
    };
  }

  return {
    success: "Account created. We sent a confirmation link to your email — click it to sign in.",
    email,
  };
}

export async function resendVerificationAction(email: string): Promise<AuthFormState> {
  const trimmed = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: trimmed } });
  if (!user || user.emailVerified) {
    return { success: "If this account needs verification, a new link has been sent." };
  }
  try {
    await sendVerificationLink(trimmed);
  } catch (error) {
    console.error("Failed to send verification email", error);
    return { error: "Could not send the verification email right now. Please try again." };
  }
  return { success: "A new verification link is on its way. Check your inbox." };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { error: "Please enter your email." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.password) {
    const token = generateToken();
    await storeToken(email, token);
    const baseUrl = await getBaseUrl();
    const resetUrl = buildUrl(baseUrl, "/reset-password", { token, email });
    try {
      await sendPasswordResetEmail(email, resetUrl);
    } catch (error) {
      console.error("Failed to send password reset email", error);
      return { error: "Could not send the reset email right now. Please try again." };
    }
  }

  return { success: "If an account exists for that email, a reset link is on its way." };
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !token) {
    return { error: "This reset link is invalid. Request a new one." };
  }
  const passwordErrorMsg = passwordError(password);
  if (passwordErrorMsg) {
    return { error: passwordErrorMsg };
  }

  const valid = await verifyToken(email, token);
  if (!valid) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { email }, data: { password: hashed } });
  await revokeTokens(email);

  return { success: "Password updated. Sign in with your new password." };
}
