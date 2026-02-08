/**
 * Stored session interface
 */
interface StoredSession {
  token: string;
  expiresAt: number;
  rememberMe: boolean;
}

/**
 * Token Service
 * Manages JWT token storage, retrieval, and validation
 */
class TokenService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly SESSION_KEY = 'auth_session';

  /**
   * Set authentication token with expiration
   * 
   * @param token - JWT token
   * @param rememberMe - Whether to remember the user (30 days vs 24 hours)
   */
  setToken(token: string, rememberMe: boolean = false): void {
    // Calculate expiration time
    const expirationHours = rememberMe ? 30 * 24 : 24; // 30 days or 24 hours
    const expiresAt = Date.now() + expirationHours * 60 * 60 * 1000;

    // Store token in localStorage
    localStorage.setItem(this.TOKEN_KEY, token);

    // Store session metadata
    const session: StoredSession = {
      token,
      expiresAt,
      rememberMe,
    };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
  }

  /**
   * Get authentication token
   * 
   * @returns Token string or null if not found/expired
   */
  getToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    
    if (!token) {
      return null;
    }

    // Check if token is expired
    if (!this.isTokenValid()) {
      this.clearToken();
      return null;
    }

    return token;
  }

  /**
   * Clear authentication token and session data
   */
  clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.SESSION_KEY);
  }

  /**
   * Check if token is valid (not expired)
   * 
   * @returns True if token is valid, false otherwise
   */
  isTokenValid(): boolean {
    const sessionData = localStorage.getItem(this.SESSION_KEY);
    
    if (!sessionData) {
      return false;
    }

    try {
      const session: StoredSession = JSON.parse(sessionData);
      return Date.now() < session.expiresAt;
    } catch (error) {
      console.error('Error parsing session data:', error);
      return false;
    }
  }

  /**
   * Get token expiration date
   * 
   * @returns Expiration date or null if not found
   */
  getTokenExpiration(): Date | null {
    const sessionData = localStorage.getItem(this.SESSION_KEY);
    
    if (!sessionData) {
      return null;
    }

    try {
      const session: StoredSession = JSON.parse(sessionData);
      return new Date(session.expiresAt);
    } catch (error) {
      console.error('Error parsing session data:', error);
      return null;
    }
  }

  /**
   * Get session metadata
   * 
   * @returns Session metadata or null if not found
   */
  getSession(): StoredSession | null {
    const sessionData = localStorage.getItem(this.SESSION_KEY);
    
    if (!sessionData) {
      return null;
    }

    try {
      return JSON.parse(sessionData);
    } catch (error) {
      console.error('Error parsing session data:', error);
      return null;
    }
  }

  /**
   * Check if user has "remember me" enabled
   * 
   * @returns True if remember me is enabled, false otherwise
   */
  hasRememberMe(): boolean {
    const session = this.getSession();
    return session?.rememberMe ?? false;
  }
}

// Export singleton instance
export const tokenService = new TokenService();
