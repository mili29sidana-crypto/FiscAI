import { AccountType, FirmRole } from "@prisma/client";
import { z } from "zod";
 
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "12345678",
  "qwerty123",
  "letmein123",
  "welcome123",
  "admin123",
]);
 
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .refine((value) => /[a-z]/.test(value), "Password must contain a lowercase letter")
  .refine((value) => /[A-Z]/.test(value), "Password must contain an uppercase letter")
  .refine((value) => /\d/.test(value), "Password must contain a digit")
  .refine((value) => /[^A-Za-z0-9]/.test(value), "Password must contain a symbol")
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), "Password is too common");
 
export const emailSchema = z.email("A valid email address is required").max(254);
 
const confirmedPassword = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .refine(
      (value) =>
        (value as { password: string; confirmPassword: string }).password ===
        (value as { password: string; confirmPassword: string }).confirmPassword,
      { message: "Passwords do not match", path: ["confirmPassword"] },
    );
 
export const registerSchema = confirmedPassword({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "Enter a valid phone number")
    .optional(),
});
 
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
 
export const tokenSchema = z.object({ token: z.string().min(16).max(256) });
 
export const emailOnlySchema = z.object({ email: emailSchema });
 
export const resetPasswordSchema = confirmedPassword({
  token: z.string().min(16).max(256),
  password: passwordSchema,
  confirmPassword: z.string(),
});
 
export const changePasswordSchema = confirmedPassword({
  currentPassword: z.string().min(1),
  password: passwordSchema,
  confirmPassword: z.string(),
});
 
export const accountTypeSchema = z.object({
  accountType: z.enum(AccountType),
});
 
export const caDetailsSchema = z.object({
  icaiMembershipNumber: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "ICAI membership number must be six digits"),
  professionalName: z.string().trim().min(1).max(120),
  practiceName: z.string().trim().max(160).optional(),
  copStatus: z.enum(["HELD", "NOT_HELD", "APPLIED"]).optional(),
  supportingReference: z.string().trim().max(500).optional(),
});
 
export const firmDetailsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.enum(["SOLE_PROPRIETORSHIP", "PARTNERSHIP", "LLP", "COMPANY"]),
  addressLine: z.string().trim().max(240).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  country: z.string().trim().length(2).default("IN"),
  contactEmail: emailSchema,
  contactPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "Enter a valid phone number")
    .optional(),
  registrationNumber: z.string().trim().max(60).optional(),
});
 
export const firmUpdateSchema = firmDetailsSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field must be provided",
);
 
export const invitationSchema = z.object({
  email: emailSchema,
  role: z.enum([FirmRole.PARTNER_CA, FirmRole.STAFF, FirmRole.CLIENT]),
});
 
export const roleChangeSchema = z.object({
  role: z.enum([FirmRole.FIRM_ADMIN, FirmRole.PARTNER_CA, FirmRole.STAFF, FirmRole.CLIENT]),
});
 
export const rejectionSchema = z.object({
  reason: z.string().trim().min(10, "A rejection reason of at least 10 characters is required"),
  reviewerNotes: z.string().trim().max(2000).optional(),
});
 
export const approvalSchema = z.object({
  reviewerNotes: z.string().trim().max(2000).optional(),
});
 
export const requestInformationSchema = z.object({
  message: z.string().trim().min(10, "Describe the information required"),
});
 
export const reviewQueueSchema = z.object({
  status: z
    .enum(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "ALL"])
    .default("SUBMITTED"),
  page: z.coerce.number().int().min(1).default(1),
});