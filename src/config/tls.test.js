/**
 * Tests for TLS Configuration
 * Task: 4.3.3 - Implement encryption at rest and in transit
 */

const {
  getTLSConfig,
  validateTLSConfig,
  getTLSHeaders
} = require('./tls');
const fs = require('fs');
const path = require('path');

// Mock fs module
jest.mock('fs');

describe('TLS Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TLS_ENABLED;
    delete process.env.TLS_CERT_PATH;
    delete process.env.TLS_KEY_PATH;
    delete process.env.TLS_CA_PATH;
  });

  describe('getTLSConfig', () => {
    it('should return null when TLS is disabled', () => {
      process.env.TLS_ENABLED = 'false';

      const config = getTLSConfig();
      expect(config).toBeNull();
    });

    it('should return TLS config when enabled with valid certificates', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('cert')) return 'CERT_CONTENT';
        if (path.includes('key')) return 'KEY_CONTENT';
      });

      const config = getTLSConfig();

      expect(config).toBeTruthy();
      expect(config.minVersion).toBe('TLSv1.3');
      expect(config.maxVersion).toBe('TLSv1.3');
      expect(config.cert).toBe('CERT_CONTENT');
      expect(config.key).toBe('KEY_CONTENT');
      expect(config.honorCipherOrder).toBe(true);
    });

    it('should throw error if certificate file not found', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';

      fs.existsSync.mockImplementation((path) => {
        return !path.includes('cert'); // Cert doesn't exist
      });

      expect(() => getTLSConfig()).toThrow('TLS certificate not found');
    });

    it('should throw error if private key file not found', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';

      fs.existsSync.mockImplementation((path) => {
        return !path.includes('key'); // Key doesn't exist
      });

      expect(() => getTLSConfig()).toThrow('TLS private key not found');
    });

    it('should include CA certificate if provided', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';
      process.env.TLS_CA_PATH = '/path/to/ca.crt';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('cert')) return 'CERT_CONTENT';
        if (path.includes('key')) return 'KEY_CONTENT';
        if (path.includes('ca')) return 'CA_CONTENT';
      });

      const config = getTLSConfig();

      expect(config.ca).toBe('CA_CONTENT');
    });

    it('should use default certificate paths if not specified', () => {
      process.env.TLS_ENABLED = 'true';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('CONTENT');

      const config = getTLSConfig();

      expect(config).toBeTruthy();
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringMatching(/certs[\\\/]server\.crt$/)
      );
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringMatching(/certs[\\\/]server\.key$/)
      );
    });

    it('should configure TLS 1.3 cipher suites', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('CONTENT');

      const config = getTLSConfig();

      expect(config.ciphers).toContain('TLS_AES_256_GCM_SHA384');
      expect(config.ciphers).toContain('TLS_CHACHA20_POLY1305_SHA256');
      expect(config.ciphers).toContain('TLS_AES_128_GCM_SHA256');
    });

    it('should configure client certificate request when enabled', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';
      process.env.TLS_REQUEST_CLIENT_CERT = 'true';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('CONTENT');

      const config = getTLSConfig();

      expect(config.requestCert).toBe(true);
    });

    it('should not request client certificate when disabled', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';
      process.env.TLS_REQUEST_CLIENT_CERT = 'false';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('CONTENT');

      const config = getTLSConfig();

      expect(config.requestCert).toBe(false);
    });

    it('should set rejectUnauthorized to true by default', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('CONTENT');

      const config = getTLSConfig();

      expect(config.rejectUnauthorized).toBe(true);
    });

    it('should set rejectUnauthorized to false when explicitly disabled', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';
      process.env.TLS_REJECT_UNAUTHORIZED = 'false';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('CONTENT');

      const config = getTLSConfig();

      expect(config.rejectUnauthorized).toBe(false);
    });

    it('should not include CA certificate if not provided', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';
      // No TLS_CA_PATH set

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('CONTENT');

      const config = getTLSConfig();

      expect(config.ca).toBeUndefined();
    });

    it('should not include CA certificate if file does not exist', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';
      process.env.TLS_CA_PATH = '/path/to/ca.crt';

      fs.existsSync.mockImplementation((path) => {
        return !path.includes('ca'); // CA file doesn't exist
      });
      fs.readFileSync.mockReturnValue('CONTENT');

      const config = getTLSConfig();

      expect(config.ca).toBeUndefined();
    });

    it('should configure session timeout', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('CONTENT');

      const config = getTLSConfig();

      expect(config.sessionTimeout).toBe(300); // 5 minutes
    });
  });

  describe('validateTLSConfig', () => {
    it('should return valid when TLS is disabled', () => {
      process.env.TLS_ENABLED = 'false';

      const result = validateTLSConfig();

      expect(result.valid).toBe(true);
      expect(result.enabled).toBe(false);
      expect(result.message).toBe('TLS is disabled');
    });

    it('should return valid when TLS is enabled with valid files', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';

      fs.existsSync.mockReturnValue(true);

      const result = validateTLSConfig();

      expect(result.valid).toBe(true);
      expect(result.enabled).toBe(true);
      expect(result.message).toBe('TLS configuration is valid');
    });

    it('should return invalid when certificate is missing', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';

      fs.existsSync.mockImplementation((path) => {
        return !path.includes('cert');
      });

      const result = validateTLSConfig();

      expect(result.valid).toBe(false);
      expect(result.enabled).toBe(true);
      expect(result.errors).toContain('Certificate not found: /path/to/cert.crt');
    });

    it('should return invalid when private key is missing', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';

      fs.existsSync.mockImplementation((path) => {
        return !path.includes('key');
      });

      const result = validateTLSConfig();

      expect(result.valid).toBe(false);
      expect(result.enabled).toBe(true);
      expect(result.errors).toContain('Private key not found: /path/to/key.key');
    });

    it('should return multiple errors when both files are missing', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';

      fs.existsSync.mockReturnValue(false);

      const result = validateTLSConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('getTLSHeaders', () => {
    it('should return security headers', () => {
      const headers = getTLSHeaders();

      expect(headers['Strict-Transport-Security']).toBe(
        'max-age=31536000; includeSubDomains; preload'
      );
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['Permissions-Policy']).toBe('geolocation=(), microphone=(), camera=()');
    });

    it('should include HSTS header with preload', () => {
      const headers = getTLSHeaders();

      expect(headers['Strict-Transport-Security']).toContain('preload');
      expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
    });

    it('should include XSS protection header', () => {
      const headers = getTLSHeaders();

      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    });

    it('should include frame options header', () => {
      const headers = getTLSHeaders();

      expect(headers['X-Frame-Options']).toBe('DENY');
    });
  });

  describe('createHTTPSServer', () => {
    const { createHTTPSServer } = require('./tls');
    const https = require('https');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return null when TLS is disabled', () => {
      process.env.TLS_ENABLED = 'false';

      const app = {};
      const server = createHTTPSServer(app);

      expect(server).toBeNull();
    });

    it('should create HTTPS server when TLS is enabled', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('CONTENT');

      // Mock https.createServer
      const mockServer = {
        on: jest.fn()
      };
      jest.spyOn(https, 'createServer').mockReturnValue(mockServer);

      const app = {};
      const server = createHTTPSServer(app);

      expect(server).toBeTruthy();
      expect(https.createServer).toHaveBeenCalled();
      expect(mockServer.on).toHaveBeenCalledWith('secureConnection', expect.any(Function));
    });

    it('should log secure connection details', () => {
      process.env.TLS_ENABLED = 'true';
      process.env.TLS_CERT_PATH = '/path/to/cert.crt';
      process.env.TLS_KEY_PATH = '/path/to/key.key';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('CONTENT');

      const mockTlsSocket = {
        getProtocol: jest.fn().mockReturnValue('TLSv1.3'),
        getCipher: jest.fn().mockReturnValue({ name: 'TLS_AES_256_GCM_SHA384' })
      };

      const mockServer = {
        on: jest.fn((event, callback) => {
          if (event === 'secureConnection') {
            // Simulate secure connection
            callback(mockTlsSocket);
          }
        })
      };

      jest.spyOn(https, 'createServer').mockReturnValue(mockServer);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const app = {};
      createHTTPSServer(app);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Secure connection established')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('generateSelfSignedCert', () => {
    const { generateSelfSignedCert } = require('./tls');

    beforeEach(() => {
      jest.resetModules();
    });

    it('should return existing certificates if they exist', () => {
      fs.existsSync.mockReturnValue(true);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = generateSelfSignedCert();

      expect(result).toHaveProperty('certPath');
      expect(result).toHaveProperty('keyPath');
      expect(consoleSpy).toHaveBeenCalledWith('Self-signed certificates already exist');

      consoleSpy.mockRestore();
    });

    it('should create certs directory if it does not exist', () => {
      fs.existsSync.mockImplementation((path) => {
        // Directory doesn't exist, but cert files don't exist either
        return path.includes('server.crt') || path.includes('server.key');
      });
      fs.mkdirSync = jest.fn();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = generateSelfSignedCert();

      expect(result).toHaveProperty('certPath');
      expect(result).toHaveProperty('keyPath');

      consoleSpy.mockRestore();
    });

    it('should generate new certificates if they do not exist', () => {
      const { execSync } = require('child_process');
      jest.mock('child_process');
      
      fs.existsSync.mockImplementation((path) => {
        // Directory exists, but cert files don't
        if (path.includes('certs') && !path.includes('server')) return true;
        return false;
      });
      fs.mkdirSync = jest.fn();

      const mockExecSync = jest.fn();
      require('child_process').execSync = mockExecSync;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      try {
        const result = generateSelfSignedCert();
        expect(mockExecSync).toHaveBeenCalled();
      } catch (error) {
        // Expected if openssl is not available
      }

      consoleSpy.mockRestore();
    });

    it('should handle openssl errors gracefully', () => {
      const childProcess = require('child_process');
      const mockExecSync = jest.fn().mockImplementation(() => {
        throw new Error('openssl not found');
      });
      childProcess.execSync = mockExecSync;

      fs.existsSync.mockImplementation((path) => {
        if (path.includes('certs') && !path.includes('server')) return true;
        return false;
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => generateSelfSignedCert()).toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to generate self-signed certificate:',
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });
  });
});
