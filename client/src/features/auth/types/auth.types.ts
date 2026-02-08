/**
 * Login credentials interface
 */
export interface LoginCredentials {
  tenantId: string;
  email: string;
  password: string;
  rememberMe: boolean;
  captchaToken?: string;
}

/**
 * Login response interface
 */
export interface LoginResponse {
  success: boolean;
  requiresMFA: boolean;
  sessionId?: string;
  token?: string;
  message?: string;
}

/**
 * Auth token interface
 */
export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * MFA verification request
 */
export interface MFAVerificationRequest {
  sessionId: string;
  otp: string;
}

/**
 * MFA verification response
 */
export interface MFAVerificationResponse {
  success: boolean;
  token: string;
  message?: string;
}

/**
 * SSO initiation response
 */
export interface SSOInitiationResponse {
  authorizationUrl: string;
}

/**
 * Forgot password request
 */
export interface ForgotPasswordRequest {
  email: string;
  tenantId?: string;
}

/**
 * Forgot password response
 */
export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

/**
 * User interface
 */
export interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  tenantName: string;
  roles: string[];
}
