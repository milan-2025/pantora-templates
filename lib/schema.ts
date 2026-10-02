import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name"),
  email: z.email("Please enter a valid email"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?91[\s-]?)?[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number"),
});

export type Customer = z.infer<typeof customerSchema>;
