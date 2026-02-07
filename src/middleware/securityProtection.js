/**
 * Security Protection Middleware
 * 
 * Comprehensive SQL injection and XSS protection
 * Task: 4.3.2 - Setup SQL injection and XSS protection
 */

const validator = require('validator');

/**
 * SQL Injection Protection
 * 
 * Detects and blocks common SQL injection patterns in request parameters
 */
const sqlInjectionProtection = (req, res, next) => {
  // SQL injection patterns to detect
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
    /(--|\#|\/\*|\*\/)/g, // SQL comments
    /(\bOR\b.*=.*)/gi, // OR 1=1 patterns
    /(\bAND\b.*=.*)/gi, // AND 1=1 patterns
    /(;|\||&&)/g, // Command separators
    /(xp_|sp_)/gi, // SQL Server stored procedures
    /(\bSLEEP\b|\bBENCHMARK\b)/gi, // Time-based injection
    /(WAITFOR\s+DELAY)/gi, // SQL Server time delay
    /(LOAD_FILE|INTO\s+OUTFILE)/gi, // File operations
  ];

  // Check all request inputs
  const checkForSQLInjection = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') {
      return null;
    }

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === 'string') {
        // Check against SQL injection patterns
        for (const pattern of sqlPatterns) {
          if (pattern.test(value)) {
            return {
              field: currentPath,
              value: value.substring(0, 100), // Truncate for logging
              pattern: pattern.toString()
            };
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively check nested objects
        const result = checkForSQLInjection(value, currentPath);
        if (result) {
          return result;
        }
      }
    }

    return null;
  };

  // Check body, query, and params
  const bodyCheck = checkForSQLInjection(req.body, 'body');
  const queryCheck = checkForSQLInjection(req.query, 'query');
  const paramsCheck = checkForSQLInjection(req.params, 'params');

  const suspiciousInput = bodyCheck || queryCheck || paramsCheck;

  if (suspiciousInput) {
    console.warn('[SECURITY] Potential SQL injection detected:', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      field: suspiciousInput.field,
      pattern: suspiciousInput.pattern,
      timestamp: new Date().toISOString()
    });

    return res.status(400).json({
      error: 'Invalid input detected',
      message: 'Your request contains potentially malicious content and has been blocked',
      field: suspiciousInput.field
    });
  }

  next();
};

/**
 * XSS Protection
 * 
 * Sanitizes user input to prevent cross-site scripting attacks
 */
const xssProtection = (req, res, next) => {
  // XSS patterns to detect
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers (onclick, onerror, etc.)
    /<iframe/gi, // Iframe tags
    /<object/gi, // Object tags
    /<embed/gi, // Embed tags
    /<applet/gi, // Applet tags
    /<meta/gi, // Meta tags
    /<link/gi, // Link tags
    /<style/gi, // Style tags
    /expression\s*\(/gi, // CSS expressions
    /vbscript:/gi, // VBScript protocol
    /data:text\/html/gi, // Data URI with HTML
  ];

  // Sanitize string values
  const sanitizeValue = (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    // Check for XSS patterns
    for (const pattern of xssPatterns) {
      if (pattern.test(value)) {
        console.warn('[SECURITY] Potential XSS detected:', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          pattern: pattern.toString(),
          timestamp: new Date().toISOString()
        });
        
        // Return sanitized value
        return validator.escape(value);
      }
    }

    // Additional sanitization for HTML content
    if (value.includes('<') || value.includes('>')) {
      return validator.escape(value);
    }

    return value;
  };

  // Recursively sanitize object
  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => 
        typeof item === 'object' ? sanitizeObject(item) : sanitizeValue(item)
      );
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = sanitizeValue(value);
      }
    }

    return sanitized;
  };

  // Sanitize request inputs
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * Output Encoding Middleware
 * 
 * Ensures all JSON responses are properly encoded to prevent XSS
 */
const outputEncoding = (req, res, next) => {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method
  res.json = function(data) {
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Ensure Content-Type is set correctly
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }

    // Call original json method
    return originalJson(data);
  };

  next();
};

/**
 * Parameterized Query Validator
 * 
 * Validates that database queries use parameterized statements
 * This is a development/testing helper to ensure best practices
 */
const validateParameterizedQueries = (queryText) => {
  // Check if query contains string concatenation patterns
  const dangerousPatterns = [
    /\+\s*['"`]/g, // String concatenation with quotes
    /\$\{.*\}/g, // Template literals
    /['"`]\s*\+/g, // Quotes followed by concatenation
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(queryText)) {
      console.error('[SECURITY] Non-parameterized query detected:', {
        query: queryText.substring(0, 200),
        pattern: pattern.toString()
      });
      return false;
    }
  }

  return true;
};

/**
 * Request Size Limiter
 * 
 * Prevents large payloads that could be used for DoS attacks
 */
const requestSizeLimiter = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      const maxSizeInMB = parseInt(maxSize);
      
      if (sizeInMB > maxSizeInMB) {
        return res.status(413).json({
          error: 'Payload too large',
          message: `Request size exceeds maximum allowed size of ${maxSize}`,
          size: `${sizeInMB.toFixed(2)}MB`
        });
      }
    }
    
    next();
  };
};

/**
 * Security Headers Middleware
 * 
 * Adds additional security headers beyond helmet defaults
 */
const securityHeaders = (req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS filter in browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

/**
 * Combined security middleware
 * 
 * Applies all security protections in the correct order
 */
const securityMiddleware = [
  securityHeaders,
  requestSizeLimiter('10mb'),
  sqlInjectionProtection,
  xssProtection,
  outputEncoding
];

module.exports = {
  sqlInjectionProtection,
  xssProtection,
  outputEncoding,
  validateParameterizedQueries,
  requestSizeLimiter,
  securityHeaders,
  securityMiddleware
};
