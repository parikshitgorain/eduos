/**
 * Prometheus Metrics Middleware for EduOS Platform
 * Collects HTTP request metrics, system metrics, and custom business metrics
 */

const promClient = require('prom-client');

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'eduos_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// HTTP Request Duration Histogram
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status', 'service', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// HTTP Request Counter
const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status', 'service', 'tenant_id'],
  registers: [register],
});

// HTTP Request Size Histogram
const httpRequestSize = new promClient.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route', 'service'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

// HTTP Response Size Histogram
const httpResponseSize = new promClient.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'service'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

// Active Requests Gauge
const activeRequests = new promClient.Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
  labelNames: ['service'],
  registers: [register],
});

// Database Query Duration Histogram
const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table', 'tenant_id'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Database Connection Pool Gauge
const dbConnectionPool = new promClient.Gauge({
  name: 'db_connection_pool_size',
  help: 'Current size of database connection pool',
  labelNames: ['state'],
  registers: [register],
});

// Redis Operation Duration Histogram
const redisOperationDuration = new promClient.Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Duration of Redis operations in seconds',
  labelNames: ['operation', 'key_pattern'],
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

// Cache Hit Rate Counter
const cacheHits = new promClient.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type', 'key_pattern'],
  registers: [register],
});

const cacheMisses = new promClient.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type', 'key_pattern'],
  registers: [register],
});

// Business Metrics
const studentEnrollments = new promClient.Counter({
  name: 'student_enrollments_total',
  help: 'Total number of student enrollments',
  labelNames: ['tenant_id', 'program'],
  registers: [register],
});

const attendanceMarked = new promClient.Counter({
  name: 'attendance_marked_total',
  help: 'Total number of attendance records marked',
  labelNames: ['tenant_id', 'status'],
  registers: [register],
});

const paymentsProcessed = new promClient.Counter({
  name: 'payments_processed_total',
  help: 'Total number of payments processed',
  labelNames: ['tenant_id', 'status', 'gateway'],
  registers: [register],
});

const aiInferenceDuration = new promClient.Histogram({
  name: 'ai_inference_duration_seconds',
  help: 'Duration of AI inference requests in seconds',
  labelNames: ['model', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

/**
 * Middleware to collect HTTP metrics
 */
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  const service = process.env.SERVICE_NAME || 'eduos-api';
  
  // Increment active requests
  activeRequests.inc({ service });

  // Track request size
  const requestSize = parseInt(req.get('content-length') || 0, 10);
  if (requestSize > 0) {
    httpRequestSize.observe(
      {
        method: req.method,
        route: req.route?.path || req.path,
        service,
      },
      requestSize
    );
  }

  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = (Date.now() - start) / 1000;
    const tenantId = req.tenantId || 'unknown';
    const route = req.route?.path || req.path;

    // Record request duration
    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status: res.statusCode,
        service,
        tenant_id: tenantId,
      },
      duration
    );

    // Increment request counter
    httpRequestTotal.inc({
      method: req.method,
      route,
      status: res.statusCode,
      service,
      tenant_id: tenantId,
    });

    // Track response size
    const responseSize = parseInt(res.get('content-length') || 0, 10);
    if (responseSize > 0) {
      httpResponseSize.observe(
        {
          method: req.method,
          route,
          service,
        },
        responseSize
      );
    }

    // Decrement active requests
    activeRequests.dec({ service });

    // Call original end
    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Metrics endpoint handler
 */
async function metricsHandler(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error.message);
  }
}

/**
 * Helper function to record database query metrics
 */
function recordDbQuery(operation, table, tenantId, duration) {
  dbQueryDuration.observe(
    {
      operation,
      table,
      tenant_id: tenantId,
    },
    duration
  );
}

/**
 * Helper function to record Redis operation metrics
 */
function recordRedisOperation(operation, keyPattern, duration) {
  redisOperationDuration.observe(
    {
      operation,
      key_pattern: keyPattern,
    },
    duration
  );
}

/**
 * Helper function to record cache hit/miss
 */
function recordCacheHit(cacheType, keyPattern) {
  cacheHits.inc({
    cache_type: cacheType,
    key_pattern: keyPattern,
  });
}

function recordCacheMiss(cacheType, keyPattern) {
  cacheMisses.inc({
    cache_type: cacheType,
    key_pattern: keyPattern,
  });
}

/**
 * Helper function to record business metrics
 */
function recordStudentEnrollment(tenantId, program) {
  studentEnrollments.inc({
    tenant_id: tenantId,
    program,
  });
}

function recordAttendance(tenantId, status) {
  attendanceMarked.inc({
    tenant_id: tenantId,
    status,
  });
}

function recordPayment(tenantId, status, gateway) {
  paymentsProcessed.inc({
    tenant_id: tenantId,
    status,
    gateway,
  });
}

function recordAIInference(model, operation, duration) {
  aiInferenceDuration.observe(
    {
      model,
      operation,
    },
    duration
  );
}

/**
 * Update database connection pool metrics
 */
function updateDbConnectionPool(idle, active, waiting) {
  dbConnectionPool.set({ state: 'idle' }, idle);
  dbConnectionPool.set({ state: 'active' }, active);
  dbConnectionPool.set({ state: 'waiting' }, waiting);
}

module.exports = {
  metricsMiddleware,
  metricsHandler,
  register,
  // Helper functions
  recordDbQuery,
  recordRedisOperation,
  recordCacheHit,
  recordCacheMiss,
  recordStudentEnrollment,
  recordAttendance,
  recordPayment,
  recordAIInference,
  updateDbConnectionPool,
};
