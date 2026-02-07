/**
 * Structured Logging Middleware for EduOS Platform
 * Sends logs to Logstash for aggregation in Elasticsearch
 */

const winston = require('winston');
const { format } = winston;

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'eduos-api',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, service, ...meta }) => {
          return `${timestamp} [${service}] ${level}: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      ),
    }),
  ],
});

// Add Logstash transport for production
if (process.env.NODE_ENV === 'production' || process.env.LOGSTASH_ENABLED === 'true') {
  const LogstashTransport = require('winston-logstash/lib/winston-logstash-latest');
  
  logger.add(
    new LogstashTransport({
      port: parseInt(process.env.LOGSTASH_PORT || '5000', 10),
      host: process.env.LOGSTASH_HOST || 'logstash',
      node_name: process.env.HOSTNAME || 'eduos-api',
      max_connect_retries: -1,
      timeout_connect_retries: 5000,
    })
  );
}

/**
 * Middleware to log HTTP requests
 */
function loggingMiddleware(req, res, next) {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || generateRequestId();

  // Add request ID to request object
  req.requestId = requestId;

  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    tenantId: req.tenantId,
    userId: req.userId,
    headers: sanitizeHeaders(req.headers),
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - start;

    // Determine log level based on status code
    let logLevel = 'info';
    if (res.statusCode >= 500) {
      logLevel = 'error';
    } else if (res.statusCode >= 400) {
      logLevel = 'warn';
    }

    // Log response
    logger[logLevel]('Request completed', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      path: req.path,
      status: res.statusCode,
      duration,
      tenantId: req.tenantId,
      userId: req.userId,
      responseSize: res.get('content-length'),
    });

    // Call original end
    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Log an info message
 */
function logInfo(message, meta = {}) {
  logger.info(message, meta);
}

/**
 * Log a warning message
 */
function logWarn(message, meta = {}) {
  logger.warn(message, meta);
}

/**
 * Log an error message
 */
function logError(message, error, meta = {}) {
  logger.error(message, {
    ...meta,
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name,
    },
  });
}

/**
 * Log a security event
 */
function logSecurity(event, meta = {}) {
  logger.warn('Security event', {
    ...meta,
    security: true,
    event,
  });
}

/**
 * Log an audit event
 */
function logAudit(action, meta = {}) {
  logger.info('Audit event', {
    ...meta,
    audit: true,
    action,
  });
}

/**
 * Log a database query
 */
function logDbQuery(query, params, duration, meta = {}) {
  logger.debug('Database query', {
    ...meta,
    query,
    params: sanitizeParams(params),
    duration,
  });
}

/**
 * Log a Redis operation
 */
function logRedisOperation(operation, key, duration, meta = {}) {
  logger.debug('Redis operation', {
    ...meta,
    operation,
    key,
    duration,
  });
}

/**
 * Log an AI inference
 */
function logAIInference(model, operation, duration, confidence, meta = {}) {
  logger.info('AI inference', {
    ...meta,
    model,
    operation,
    duration,
    confidence,
  });
}

/**
 * Log a payment transaction
 */
function logPayment(transactionId, amount, status, gateway, meta = {}) {
  logger.info('Payment transaction', {
    ...meta,
    transactionId,
    amount,
    status,
    gateway,
  });
}

/**
 * Generate a unique request ID
 */
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitize headers to remove sensitive information
 */
function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  
  sensitiveHeaders.forEach((header) => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Sanitize query parameters to remove sensitive information
 */
function sanitizeParams(params) {
  if (!params || typeof params !== 'object') {
    return params;
  }

  const sanitized = Array.isArray(params) ? [...params] : { ...params };
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'api_key'];

  if (Array.isArray(sanitized)) {
    return sanitized.map((param) => {
      if (typeof param === 'object') {
        return sanitizeParams(param);
      }
      return param;
    });
  }

  Object.keys(sanitized).forEach((key) => {
    if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeParams(sanitized[key]);
    }
  });

  return sanitized;
}

/**
 * Error logging middleware
 */
function errorLoggingMiddleware(err, req, res, next) {
  logError('Unhandled error', err, {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    tenantId: req.tenantId,
    userId: req.userId,
  });

  next(err);
}

module.exports = {
  logger,
  loggingMiddleware,
  errorLoggingMiddleware,
  logInfo,
  logWarn,
  logError,
  logSecurity,
  logAudit,
  logDbQuery,
  logRedisOperation,
  logAIInference,
  logPayment,
};
