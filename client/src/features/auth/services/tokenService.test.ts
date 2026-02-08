import { describe, it, expect, beforeEach } from 'vitest';
import { tokenService } from './tokenService';

describe('tokenService', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('stores token with expiration', () => {
    const token = 'test-token-123';
    tokenService.setToken(token, false);

    const retrieved = tokenService.getToken();
    expect(retrieved).toBe(token);
  });

  it('stores token with extended expiration when rememberMe is true', () => {
    const token = 'test-token-123';
    tokenService.setToken(token, true);

    const retrieved = tokenService.getToken();
    expect(retrieved).toBe(token);
  });

  it('returns null when token does not exist', () => {
    const retrieved = tokenService.getToken();
    expect(retrieved).toBeNull();
  });

  it('returns null when token is expired', () => {
    const token = 'test-token-123';
    // Manually set an expired token
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_session', JSON.stringify({
      token,
      expiresAt: Date.now() - 1000, // Expired 1 second ago
      rememberMe: false,
    }));

    const retrieved = tokenService.getToken();
    expect(retrieved).toBeNull();
  });

  it('clears token from storage', () => {
    const token = 'test-token-123';
    tokenService.setToken(token, false);

    tokenService.clearToken();

    const retrieved = tokenService.getToken();
    expect(retrieved).toBeNull();
  });

  it('validates token correctly', () => {
    const token = 'test-token-123';
    tokenService.setToken(token, false);

    expect(tokenService.isTokenValid()).toBe(true);

    tokenService.clearToken();

    expect(tokenService.isTokenValid()).toBe(false);
  });

  it('returns false for expired token validation', () => {
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('auth_session', JSON.stringify({
      token: 'test-token',
      expiresAt: Date.now() - 1000,
      rememberMe: false,
    }));

    expect(tokenService.isTokenValid()).toBe(false);
  });
});
