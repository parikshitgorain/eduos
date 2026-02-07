/**
 * Performance Monitoring Middleware
 * 
 * Task: 4.4.4 - Setup performance optimization and caching
 * 
 * Tracks API performance metrics:
 * - Response times (p50, p95, p99)
 * - Request throughput
 * - Error rates
 * - Cache hit rates
 * - Slow query detection
 * 
 * Metrics are stored in Redis and exposed via /api/v1/metrics endpoint
 */

const { redis } = require('../config/redis');
const { performance } = require('perf_hooks');

// Performance thresholds
const THRESHOLDS = {
  SLOW_REQUEST: 200, // ms
  VERY_SLOW_REQUEST: 500, // ms
  P95_TARGET: 200, // ms
  P99_TARGET: 500, // ms
};

/**
 * Performance monitoring middleware
 */
function performanceMiddleware(req, res, next) {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  
  // Capture original end function
  const originalEnd = res.end;
  
  // Override end function to capture metrics
  res.end = function(...args) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    const endMemory = process.memoryUsage();
    
    // Calculate memory delta
    const memoryDelta = {
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external,
    };
    
    // Record metrics asynchronously (don't block response)
    setImmediate(() => {
      recordMetrics({
        method: req.method,
        path: req.route?.path || req.path,
        statusCode: res.statusCode,
        responseTime,
        memoryDelta,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Add performance headers
    res.setHeader('X-Response-Time', `${responseTime.toFixed(2)}ms`);
    res.setHeader('X-Request-ID', req.id || 'unknown');
    
    // Log slow requests
    if (responseTime > THRESHOLDS.VERY_SLOW_REQUEST) {
      console.warn('Very slow request detected:', {
        method: req.method,
        path: req.path,
        responseTime: `${responseTime.toFixed(2)}ms`,
        statusCode: res.statusCode,
      });
    } else if (responseTime > THRESHOLDS.SLOW_REQUEST) {
      console.log('Slow request detected:', {
        method: req.method,
        path: req.path,
        responseTime: `${responseTime.toFixed(2)}ms`,
      });
    }
    
    // Call original end function
    originalEnd.apply(res, args);
  };
  
  next();
}

/**
 * Record performance metrics in Redis
 */
async function recordMetrics(metrics) {
  try {
    const date = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    
    // Keys for different time granularities
    const dailyKey = `metrics:daily:${date}`;
    const hourlyKey = `metrics:hourly:${date}:${hour}`;
    const endpointKey = `metrics:endpoint:${metrics.method}:${metrics.path}`;
    
    // Store response time in sorted set for percentile calculations
    const responseTimeKey = `metrics:response_times:${date}`;
    await redis.zadd(responseTimeKey, metrics.responseTime, `${Date.now()}-${Math.random()}`);
    await redis.expire(responseTimeKey, 86400 * 7); // Keep for 7 days
    
    // Increment request counters
    await redis.hincrby(dailyKey, 'total_requests', 1);
    await redis.hincrby(hourlyKey, 'total_requests', 1);
    await redis.hincrby(endpointKey, 'total_requests', 1);
    
    // Increment status code counters
    const statusCategory = `${Math.floor(metrics.statusCode / 100)}xx`;
    await redis.hincrby(dailyKey, `status_${statusCategory}`, 1);
    await redis.hincrby(hourlyKey, `status_${statusCategory}`, 1);
    await redis.hincrby(endpointKey, `status_${statusCategory}`, 1);
    
    // Track slow requests
    if (metrics.responseTime > THRESHOLDS.SLOW_REQUEST) {
      await redis.hincrby(dailyKey, 'slow_requests', 1);
      await redis.hincrby(hourlyKey, 'slow_requests', 1);
      await redis.hincrby(endpointKey, 'slow_requests', 1);
    }
    
    // Track very slow requests
    if (metrics.responseTime > THRESHOLDS.VERY_SLOW_REQUEST) {
      await redis.hincrby(dailyKey, 'very_slow_requests', 1);
      await redis.hincrby(hourlyKey, 'very_slow_requests', 1);
      await redis.hincrby(endpointKey, 'very_slow_requests', 1);
    }
    
    // Update response time statistics
    await redis.hincrbyfloat(dailyKey, 'total_response_time', metrics.responseTime);
    await redis.hincrbyfloat(hourlyKey, 'total_response_time', metrics.responseTime);
    await redis.hincrbyfloat(endpointKey, 'total_response_time', metrics.responseTime);
    
    // Update min/max response times
    const currentMin = parseFloat(await redis.hget(endpointKey, 'min_response_time') || Infinity);
    const currentMax = parseFloat(await redis.hget(endpointKey, 'max_response_time') || 0);
    
    if (metrics.responseTime < currentMin) {
      await redis.hset(endpointKey, 'min_response_time', metrics.responseTime);
    }
    
    if (metrics.responseTime > currentMax) {
      await redis.hset(endpointKey, 'max_response_time', metrics.responseTime);
    }
    
    // Set expiration
    await redis.expire(dailyKey, 86400 * 30); // Keep for 30 days
    await redis.expire(hourlyKey, 86400 * 7); // Keep for 7 days
    await redis.expire(endpointKey, 86400 * 30); // Keep for 30 days
  } catch (error) {
    console.error('Failed to record metrics:', error);
  }
}

/**
 * Calculate percentile from sorted set
 */
async function calculatePercentile(key, percentile) {
  try {
    const count = await redis.zcard(key);
    if (count === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * count) - 1;
    const values = await redis.zrange(key, index, index, 'WITHSCORES');
    
    return values.length > 1 ? parseFloat(values[1]) : 0;
  } catch (error) {
    console.error('Failed to calculate percentile:', error);
    return 0;
  }
}

/**
 * Get performance metrics
 */
async function getPerformanceMetrics(date = null) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const dailyKey = `metrics:daily:${targetDate}`;
    const responseTimeKey = `metrics:response_times:${targetDate}`;
    
    // Get basic metrics
    const metrics = await redis.hgetall(dailyKey);
    
    if (!metrics || Object.keys(metrics).length === 0) {
      return {
        date: targetDate,
        message: 'No metrics available for this date',
      };
    }
    
    // Calculate derived metrics
    const totalRequests = parseInt(metrics.total_requests || 0);
    const totalResponseTime = parseFloat(metrics.total_response_time || 0);
    const avgResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    
    const slowRequests = parseInt(metrics.slow_requests || 0);
    const verySlowRequests = parseInt(metrics.very_slow_requests || 0);
    const slowRequestRate = totalRequests > 0 ? (slowRequests / totalRequests * 100) : 0;
    
    // Calculate percentiles
    const p50 = await calculatePercentile(responseTimeKey, 50);
    const p95 = await calculatePercentile(responseTimeKey, 95);
    const p99 = await calculatePercentile(responseTimeKey, 99);
    
    // Calculate success rate
    const status2xx = parseInt(metrics.status_2xx || 0);
    const successRate = totalRequests > 0 ? (status2xx / totalRequests * 100) : 0;
    
    return {
      date: targetDate,
      requests: {
        total: totalRequests,
        status_2xx: parseInt(metrics.status_2xx || 0),
        status_3xx: parseInt(metrics.status_3xx || 0),
        status_4xx: parseInt(metrics.status_4xx || 0),
        status_5xx: parseInt(metrics.status_5xx || 0),
        successRate: `${successRate.toFixed(2)}%`,
      },
      responseTimes: {
        avg: `${avgResponseTime.toFixed(2)}ms`,
        p50: `${p50.toFixed(2)}ms`,
        p95: `${p95.toFixed(2)}ms`,
        p99: `${p99.toFixed(2)}ms`,
      },
      performance: {
        slowRequests,
        verySlowRequests,
        slowRequestRate: `${slowRequestRate.toFixed(2)}%`,
      },
      targets: {
        p95Target: `${THRESHOLDS.P95_TARGET}ms`,
        p95Met: p95 < THRESHOLDS.P95_TARGET ? '✅ PASS' : '❌ FAIL',
        p99Target: `${THRESHOLDS.P99_TARGET}ms`,
        p99Met: p99 < THRESHOLDS.P99_TARGET ? '✅ PASS' : '❌ FAIL',
      },
    };
  } catch (error) {
    console.error('Failed to get performance metrics:', error);
    throw error;
  }
}

/**
 * Get endpoint-specific metrics
 */
async function getEndpointMetrics(method, path) {
  try {
    const endpointKey = `metrics:endpoint:${method}:${path}`;
    const metrics = await redis.hgetall(endpointKey);
    
    if (!metrics || Object.keys(metrics).length === 0) {
      return {
        method,
        path,
        message: 'No metrics available for this endpoint',
      };
    }
    
    const totalRequests = parseInt(metrics.total_requests || 0);
    const totalResponseTime = parseFloat(metrics.total_response_time || 0);
    const avgResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    
    return {
      method,
      path,
      requests: {
        total: totalRequests,
        status_2xx: parseInt(metrics.status_2xx || 0),
        status_4xx: parseInt(metrics.status_4xx || 0),
        status_5xx: parseInt(metrics.status_5xx || 0),
      },
      responseTimes: {
        min: `${parseFloat(metrics.min_response_time || 0).toFixed(2)}ms`,
        max: `${parseFloat(metrics.max_response_time || 0).toFixed(2)}ms`,
        avg: `${avgResponseTime.toFixed(2)}ms`,
      },
      performance: {
        slowRequests: parseInt(metrics.slow_requests || 0),
        verySlowRequests: parseInt(metrics.very_slow_requests || 0),
      },
    };
  } catch (error) {
    console.error('Failed to get endpoint metrics:', error);
    throw error;
  }
}

/**
 * Get top slow endpoints
 */
async function getSlowEndpoints(limit = 10) {
  try {
    const pattern = 'metrics:endpoint:*';
    const keys = await redis.keys(pattern);
    
    const endpoints = [];
    
    for (const key of keys) {
      const metrics = await redis.hgetall(key);
      const totalRequests = parseInt(metrics.total_requests || 0);
      const totalResponseTime = parseFloat(metrics.total_response_time || 0);
      const avgResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
      
      if (totalRequests > 0) {
        const [, , method, ...pathParts] = key.split(':');
        const path = pathParts.join(':');
        
        endpoints.push({
          method,
          path,
          avgResponseTime,
          totalRequests,
          slowRequests: parseInt(metrics.slow_requests || 0),
        });
      }
    }
    
    // Sort by average response time
    endpoints.sort((a, b) => b.avgResponseTime - a.avgResponseTime);
    
    return endpoints.slice(0, limit).map(ep => ({
      ...ep,
      avgResponseTime: `${ep.avgResponseTime.toFixed(2)}ms`,
    }));
  } catch (error) {
    console.error('Failed to get slow endpoints:', error);
    throw error;
  }
}

module.exports = {
  performanceMiddleware,
  getPerformanceMetrics,
  getEndpointMetrics,
  getSlowEndpoints,
  THRESHOLDS,
};
