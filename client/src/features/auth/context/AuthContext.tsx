import { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../services/authService';
import { tokenService } from '../services/tokenService';
import type { User, LoginCredentials, MFAVerificationRequest } from '../types/auth.types';
import { isAPIError } from '../../../config/apiClient';

/**
 * Authentication state interface
 */
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Authentication context interface
 */
export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ requiresMFA: boolean; sessionId?: string }>;
  verifyMFA: (request: MFAVerificationRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User | null) => void;
}

/**
 * Create authentication context
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider Component
 * Manages global authentication state and provides auth actions
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing token on mount
  useEffect(() => {
    const existingToken = tokenService.getToken();
    if (existingToken) {
      setToken(existingToken);
      // TODO: Fetch user data from token or API
      // For now, we'll set isAuthenticated based on token presence
    }
    setIsLoading(false);
  }, []);

  /**
   * Login with email and password
   */
  const login = async (credentials: LoginCredentials): Promise<{ requiresMFA: boolean; sessionId?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(credentials);

      if (response.requiresMFA) {
        // MFA required - return session ID for MFA verification
        setIsLoading(false);
        return {
          requiresMFA: true,
          sessionId: response.sessionId,
        };
      }

      // Login successful without MFA
      if (response.token) {
        tokenService.setToken(response.token, credentials.rememberMe || false);
        setToken(response.token);
        // TODO: Decode token or fetch user data
        // For now, we'll just set authenticated state
      }

      setIsLoading(false);
      return {
        requiresMFA: false,
      };
    } catch (err) {
      const errorMessage = isAPIError(err) ? err.message : 'Login failed. Please try again.';
      setError(errorMessage);
      setIsLoading(false);
      throw err;
    }
  };

  /**
   * Verify MFA code
   */
  const verifyMFA = async (request: MFAVerificationRequest): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.verifyMFA(request);

      if (response.token) {
        tokenService.setToken(response.token, false); // MFA sessions don't use remember me
        setToken(response.token);
        // TODO: Decode token or fetch user data
      }

      setIsLoading(false);
    } catch (err) {
      const errorMessage = isAPIError(err) ? err.message : 'MFA verification failed. Please try again.';
      setError(errorMessage);
      setIsLoading(false);
      throw err;
    }
  };

  /**
   * Logout user
   */
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
      // Continue with local logout even if API call fails
    } finally {
      tokenService.clearToken();
      setToken(null);
      setUser(null);
      setIsLoading(false);
    }
  };

  /**
   * Clear error message
   */
  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    error,
    login,
    verifyMFA,
    logout,
    clearError,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
