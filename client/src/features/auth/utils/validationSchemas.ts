import { z } from 'zod';

/**
 * Login form validation schema
 * Validates tenant selection, email, password, remember me checkbox, and optional CAPTCHA token
 */
export const loginSchema = z.object({
  tenantId: z.string().min(1, 'Please select an institution'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
  captchaToken: z.string().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * MFA (Multi-Factor Authentication) validation schema
 * Validates 6-digit OTP code
 */
export const mfaSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export type MFAFormData = z.infer<typeof mfaSchema>;

/**
 * Forgot password form validation schema
 * Validates email address for password reset
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
