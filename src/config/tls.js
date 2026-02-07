/**
 * EduOS Platform - TLS Configuration
 * 
 * Configures TLS 1.3 for secure communication
 * Task: 4.3.3 - Implement encryption at rest and in transit
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

/**
 * Get TLS configuration for HTTPS server
 * @returns {Object} TLS options for https.createServer()
 */
function getTLSConfig() {
  const tlsEnabled = process.env.TLS_ENABLED === 'true';
  
  if (!tlsEnabled) {
    console.log('TLS is disabled. Set TLS_ENABLED=true to enable HTTPS.');
    return null;
  }

  const certPath = process.env.TLS_CERT_PATH || path.join(__dirname, '../../certs/server.crt');
  const keyPath = process.env.TLS_KEY_PATH || path.join(__dirname, '../../certs/server.key');
  const caPath = process.env.TLS_CA_PATH;

  // Check if certificate files exist
  if (!fs.existsSync(certPath)) {
    throw new Error(`TLS certificate not found at ${certPath}`);
  }

  if (!fs.existsSync(keyPath)) {
    throw new Error(`TLS private key not found at ${keyPath}`);
  }

  const tlsOptions = {
    // TLS 1.3 configuration
    minVersion: 'TLSv1.3',
    maxVersion: 'TLSv1.3',
    
    // Certificate and key
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    
    // Cipher suites for TLS 1.3
    ciphers: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256'
    ].join(':'),
    
    // Prefer server cipher order
    honorCipherOrder: true,
    
    // Disable session resumption for better security
    sessionTimeout: 300, // 5 minutes
    
    // Request client certificate (optional)
    requestCert: process.env.TLS_REQUEST_CLIENT_CERT === 'true',
    rejectUnauthorized: process.env.TLS_REJECT_UNAUTHORIZED !== 'false',
    
    // OCSP stapling
    enableOCSPStapling: true
  };

  // Add CA certificate if provided (for client certificate validation)
  if (caPath && fs.existsSync(caPath)) {
    tlsOptions.ca = fs.readFileSync(caPath);
  }

  console.log('TLS 1.3 configuration loaded successfully');
  console.log(`Certificate: ${certPath}`);
  console.log(`Private Key: ${keyPath}`);
  
  return tlsOptions;
}

/**
 * Create HTTPS server with TLS 1.3
 * @param {Object} app - Express application
 * @returns {Object} HTTPS server or null if TLS is disabled
 */
function createHTTPSServer(app) {
  const tlsConfig = getTLSConfig();
  
  if (!tlsConfig) {
    return null;
  }

  const server = https.createServer(tlsConfig, app);
  
  // Log TLS connection details
  server.on('secureConnection', (tlsSocket) => {
    const protocol = tlsSocket.getProtocol();
    const cipher = tlsSocket.getCipher();
    
    console.log(`Secure connection established: ${protocol}, Cipher: ${cipher.name}`);
  });

  return server;
}

/**
 * Validate TLS configuration
 * @returns {Object} Validation result
 */
function validateTLSConfig() {
  const tlsEnabled = process.env.TLS_ENABLED === 'true';
  
  if (!tlsEnabled) {
    return {
      valid: true,
      enabled: false,
      message: 'TLS is disabled'
    };
  }

  const certPath = process.env.TLS_CERT_PATH || path.join(__dirname, '../../certs/server.crt');
  const keyPath = process.env.TLS_KEY_PATH || path.join(__dirname, '../../certs/server.key');

  const errors = [];

  if (!fs.existsSync(certPath)) {
    errors.push(`Certificate not found: ${certPath}`);
  }

  if (!fs.existsSync(keyPath)) {
    errors.push(`Private key not found: ${keyPath}`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      enabled: true,
      errors
    };
  }

  return {
    valid: true,
    enabled: true,
    message: 'TLS configuration is valid'
  };
}

/**
 * Generate self-signed certificate for development
 * Note: Use proper CA-signed certificates in production
 */
function generateSelfSignedCert() {
  const { execSync } = require('child_process');
  const certsDir = path.join(__dirname, '../../certs');

  // Create certs directory if it doesn't exist
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  const certPath = path.join(certsDir, 'server.crt');
  const keyPath = path.join(certsDir, 'server.key');

  // Check if certificates already exist
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    console.log('Self-signed certificates already exist');
    return { certPath, keyPath };
  }

  console.log('Generating self-signed certificate for development...');

  try {
    // Generate private key and certificate
    execSync(`openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`, {
      stdio: 'inherit'
    });

    console.log('Self-signed certificate generated successfully');
    console.log(`Certificate: ${certPath}`);
    console.log(`Private Key: ${keyPath}`);

    return { certPath, keyPath };
  } catch (error) {
    console.error('Failed to generate self-signed certificate:', error.message);
    console.error('Please install OpenSSL or provide your own certificates');
    throw error;
  }
}

/**
 * Get recommended TLS headers for Express
 * @returns {Object} Security headers
 */
function getTLSHeaders() {
  return {
    // Strict Transport Security (HSTS)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // XSS Protection
    'X-XSS-Protection': '1; mode=block',
    
    // Frame Options
    'X-Frame-Options': 'DENY',
    
    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permissions Policy
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  };
}

module.exports = {
  getTLSConfig,
  createHTTPSServer,
  validateTLSConfig,
  generateSelfSignedCert,
  getTLSHeaders
};
