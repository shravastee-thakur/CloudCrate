import { z } from "zod";

// Register Validation

export const registerSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(50, "Name must be at most 50 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(14, "Password must be at most 14 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// Login Validation

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// OTP Verification Validation

export const verifyOtpSchema = z.object({
  userId: z.string().length(24, "Invalid user ID"),
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// Forgot Password Validation

export const forgetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type ForgetPasswordInput = z.infer<typeof forgetPasswordSchema>;

// Reset Password Validation

export const resetPasswordSchema = z.object({
  userId: z.string().length(24, "Invalid user ID"),
  token: z.string().min(10, "Invalid token"), // matches crypto.randomBytes(10)
  newPassword: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be at most 128 characters"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
