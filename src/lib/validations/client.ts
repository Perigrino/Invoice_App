import { z } from "zod";

export const clientSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  company: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;
