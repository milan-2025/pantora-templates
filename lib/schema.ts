import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.email("Please enter a valid email"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?91[\s-]?)?[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number"),
  city: z.string().trim().max(60).optional().default(""),
});

export type Customer = z.infer<typeof customerSchema>;

export const promoCodeSchema = z
  .string()
  .trim()
  .max(30)
  .optional()
  .transform((v) => (v ? v.toUpperCase() : undefined));

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.email("Please enter a valid email"),
  phone: z.string().trim().max(20).optional().default(""),
  message: z.string().trim().min(5, "Please write a short message").max(4000),
  page: z.string().max(200).optional().default(""),
  website: z.string().optional(), // honeypot
});
