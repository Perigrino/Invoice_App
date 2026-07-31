"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/dal";
import { revalidatePath } from "next/cache";

export type AccountState = {
  message?: string;
  error?: string;
};

const UpdateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").trim(),
  email: z.string().email("Please enter a valid email.").trim(),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
});

export async function updateProfile(
  _prevState: AccountState | undefined,
  formData: FormData
): Promise<AccountState> {
  const userId = await requireUserId();

  const validatedFields = UpdateProfileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    const error = validatedFields.error.errors[0]?.message || "Invalid input.";
    return { error };
  }

  const { name, email } = validatedFields.data;

  const existing = await prisma.user.findFirst({
    where: { email, NOT: { id: userId } },
  });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { name, email },
    });
    revalidatePath("/settings");
    return { message: "Profile updated successfully." };
  } catch {
    return { error: "An error occurred while updating your profile." };
  }
}

export async function changePassword(
  _prevState: AccountState | undefined,
  formData: FormData
): Promise<AccountState> {
  const userId = await requireUserId();

  const validatedFields = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });

  if (!validatedFields.success) {
    const error = validatedFields.error.errors[0]?.message || "Invalid input.";
    return { error };
  }

  const { currentPassword, newPassword } = validatedFields.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.password) {
    return { error: "Unable to verify your current password." };
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return { error: "Your current password is incorrect." };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    return { message: "Password changed successfully." };
  } catch {
    return { error: "An error occurred while changing your password." };
  }
}
