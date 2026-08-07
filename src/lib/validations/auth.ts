import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(20, "Username must be at most 20 characters.")
  .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, and underscores.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters.")
  .regex(/[A-Z]/, "One uppercase letter.")
  .regex(/[a-z]/, "One lowercase letter.")
  .regex(/[0-9]/, "One number.")
  .regex(/[^A-Za-z0-9]/, "One special character.");

export type PasswordRule = { id: string; label: string; test: (p: string) => boolean };

export const passwordRules: PasswordRule[] = [
  { id: "len", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "num", label: "One number", test: (p) => /[0-9]/.test(p) },
  { id: "special", label: "One special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordError(password: string): string | undefined {
  const result = passwordSchema.safeParse(password);
  return result.success ? undefined : result.error.issues[0]?.message;
}
