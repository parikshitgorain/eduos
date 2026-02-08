import { apiClient } from '../../../config/apiClient';
import type {
  LoginCredentials,
  LoginResponse,
  MFAVerificationRequest,
  MFAVerificationResponse,
  SSOInitiationResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
} from '../types/auth.types';

/**
 * Authentication Service
 * Handles all authentication-related API calls
 */
class AuthService {
  /**
   * Login with email and password
   * 
   * @param credentials - Login credentials (tenantId, email, password, optional captchaToken)
   * @returns Login response with MFA requirement or token
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', credentials);
    return response.data;
  }

  /**
   * Verify MFA code
   * 
   * @param request - MFA verification request (sessionId, otp)
   * @returns MFA verification response with token
   */
  async verifyMFA(request: MFAVerificationRequest): Promise<MFAVerificationResponse> {
    const response = await apiClient.post<MFAVerificationResponse>(
      '/api/v1/auth/mfa/verify',
      request
    );
    return response.data;
  }

  /**
   * Initiate SSO authentication
   * 
   * @param provider - SSO provider ('google' or 'microsoft')
   * @param tenantId - Tenant ID
   * @returns SSO initiation response with authorization URL
   */
  async initiateSSO(
    provider: 'google' | 'microsoft',
    tenantId: string
  ): Promise<SSOInitiationResponse> {
    const redirectUri = `${window.location.origin}/auth/callback`;
    const response = await apiClient.get<SSOInitiationResponse>(
      `/api/v1/auth/sso/${provider}`,
      {
        params: {
          tenantId,
          redirectUri,
        },
      }
    );
    return response.data;
  }

  /**
   * Handle SSO callback
   * 
   * @param code - Authorization code from SSO provider
   * @param state - State parameter for CSRF protection
   * @returns Auth token
   */
  async handleSSOCallback(code: string, state: string): Promise<{ token: string }> {
    const response = await apiClient.post<{ token: string }>('/api/v1/auth/sso/callback', {
      code,
      state,
    });
    return response.data;
  }

  /**
   * Request password reset
   * 
   * @param request - Forgot password request (email, optional tenantId)
   * @returns Forgot password response
   */
  async forgotPassword(request: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const response = await apiClient.post<ForgotPasswordResponse>(
      '/api/v1/auth/forgot-password',
      request
    );
    return response.data;
  }

  /**
   * Logout user
   * Clears local token and calls logout endpoint
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/v1/auth/logout');
    } finally {
      // Always clear local token, even if API call fails
      localStorage.removeItem('auth_token');
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
