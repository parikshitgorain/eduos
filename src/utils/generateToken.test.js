/**
 * Generate Token Utility Tests
 */

const jwt = require('jsonwebtoken');
const {
  generateToken,
  generateTenantAToken,
  generateTenantBToken
} = require('./generateToken');

describe('Generate Token Utility', () => {
  const originalEnv = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalEnv;
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = {
        tenant_id: '11111111-1111-1111-1111-111111111111',
        user_id: '22222222-2222-2222-2222-222222222222',
        roles: ['admin'],
        permissions: ['read:students']
      };

      const token = generateToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.tenant_id).toBe(payload.tenant_id);
      expect(decoded.user_id).toBe(payload.user_id);
      expect(decoded.roles).toEqual(payload.roles);
      expect(decoded.permissions).toEqual(payload.permissions);
    });

    it('should use custom expiration time', () => {
      const payload = {
        tenant_id: '11111111-1111-1111-1111-111111111111',
        user_id: '22222222-2222-2222-2222-222222222222',
        roles: ['user'],
        permissions: []
      };

      const token = generateToken(payload, '2h');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      
      // Token should expire in approximately 2 hours
      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBeGreaterThan(7000); // ~2 hours in seconds
    });

    it('should throw error when JWT_SECRET is missing', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => {
        generateToken({ tenant_id: 'test' });
      }).toThrow('JWT_SECRET environment variable is required');

      process.env.JWT_SECRET = originalSecret;
    });

    it('should include all payload fields in token', () => {
      const payload = {
        tenant_id: '11111111-1111-1111-1111-111111111111',
        user_id: '22222222-2222-2222-2222-222222222222',
        roles: ['admin', 'teacher'],
        permissions: ['read:students', 'write:students', 'read:attendance']
      };

      const token = generateToken(payload);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      expect(decoded.tenant_id).toBe(payload.tenant_id);
      expect(decoded.user_id).toBe(payload.user_id);
      expect(decoded.roles).toEqual(payload.roles);
      expect(decoded.permissions).toEqual(payload.permissions);
    });
  });

  describe('generateTenantAToken', () => {
    it('should generate token for Tenant A', () => {
      const token = generateTenantAToken();
      expect(token).toBeDefined();

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.tenant_id).toBe('11111111-1111-1111-1111-111111111111');
      expect(decoded.user_id).toBe('22222222-2222-2222-2222-222222222222');
      expect(decoded.roles).toContain('admin');
      expect(decoded.permissions).toContain('read:students');
      expect(decoded.permissions).toContain('write:students');
    });

    it('should generate valid tokens on each call', async () => {
      const token1 = generateTenantAToken();
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const token2 = generateTenantAToken();
      
      // Both should be valid
      const decoded1 = jwt.verify(token1, process.env.JWT_SECRET);
      const decoded2 = jwt.verify(token2, process.env.JWT_SECRET);
      
      expect(decoded1.tenant_id).toBe(decoded2.tenant_id);
      expect(decoded1.user_id).toBe(decoded2.user_id);
    });
  });

  describe('generateTenantBToken', () => {
    it('should generate token for Tenant B', () => {
      const token = generateTenantBToken();
      expect(token).toBeDefined();

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.tenant_id).toBe('33333333-3333-3333-3333-333333333333');
      expect(decoded.user_id).toBe('44444444-4444-4444-4444-444444444444');
      expect(decoded.roles).toContain('teacher');
      expect(decoded.permissions).toContain('read:students');
      expect(decoded.permissions).toContain('write:attendance');
    });

    it('should have different tenant_id than Tenant A', () => {
      const tokenA = generateTenantAToken();
      const tokenB = generateTenantBToken();

      const decodedA = jwt.verify(tokenA, process.env.JWT_SECRET);
      const decodedB = jwt.verify(tokenB, process.env.JWT_SECRET);

      expect(decodedA.tenant_id).not.toBe(decodedB.tenant_id);
      expect(decodedA.user_id).not.toBe(decodedB.user_id);
    });
  });

  describe('Token expiration', () => {
    it('should generate token with default 1 hour expiration', () => {
      const payload = {
        tenant_id: '11111111-1111-1111-1111-111111111111',
        user_id: '22222222-2222-2222-2222-222222222222',
        roles: ['user'],
        permissions: []
      };

      const token = generateToken(payload);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBeGreaterThan(3500); // ~1 hour in seconds
      expect(expiresIn).toBeLessThan(3700);
    });

    it('should respect custom expiration times', () => {
      const payload = {
        tenant_id: '11111111-1111-1111-1111-111111111111',
        user_id: '22222222-2222-2222-2222-222222222222',
        roles: ['user'],
        permissions: []
      };

      const token = generateToken(payload, '30m');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBeGreaterThan(1700); // ~30 minutes
      expect(expiresIn).toBeLessThan(1900);
    });
  });

  describe('Token verification', () => {
    it('should fail verification with wrong secret', () => {
      const payload = {
        tenant_id: '11111111-1111-1111-1111-111111111111',
        user_id: '22222222-2222-2222-2222-222222222222',
        roles: ['user'],
        permissions: []
      };

      const token = generateToken(payload);

      expect(() => {
        jwt.verify(token, 'wrong-secret');
      }).toThrow();
    });

    it('should fail verification for expired token', () => {
      const payload = {
        tenant_id: '11111111-1111-1111-1111-111111111111',
        user_id: '22222222-2222-2222-2222-222222222222',
        roles: ['user'],
        permissions: []
      };

      // Generate token that expires immediately
      const token = generateToken(payload, '0s');

      // Wait a bit to ensure expiration
      return new Promise(resolve => setTimeout(resolve, 100)).then(() => {
        expect(() => {
          jwt.verify(token, process.env.JWT_SECRET);
        }).toThrow();
      });
    });
  });
});
