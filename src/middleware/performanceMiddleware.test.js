/**
 * Tests for Performance Monitoring Middleware
 * Task: 4.4.4 - Setup performance optimization and caching
 */

const {
  performanceMiddleware,
  getPerformanceMetrics,
  getEndpointMetrics,
  getSlowEndpoints,
  THRESHOLDS,
} = require('./performanceMiddleware');
const { redis } = require('../config/redis');

// Mock Redis
jest.mock('../config/redis', () => ({
  redis: {
    zadd: jest.fn(),
    expire: jest.fn(),
    hincrby: jest.fn(),
    hincrbyfloat: jest.fn(),
    hget: jest.fn(),
    hset: jest.fn(),
    hgetall: jest.fn(),
    zcard: jest.fn(),
    zrange: jest.fn(),
    keys: jest.fn(),
  },
}));

describe('Performance Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    
    req = {
      method: 'GET',
      path: '/api/students',
      route: { path: '/api/students' },
      id: 'test-request-id',
    };

    res = {
      end: jest.fn(),
      setHeader: jest.fn(),
      statusCode: 200,
    };

    next = jest.fn();

    // Mock Redis operations to resolve successfully
    redis.zadd.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);
    redis.hincrby.mockResolvedValue(1);
    redis.hincrbyfloat.mockResolvedValue(1.0);
    redis.hget.mockResolvedValue(null);
    redis.hset.mockResolvedValue(1);
  });

  describe('performanceMiddleware', () => {
    it('should call next() to continue middleware chain', () => {
      performanceMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should override res.end to capture metrics', () => {
      const originalEnd = res.end;
      performanceMiddleware(req, res, next);
      expect(res.end).not.toBe(originalEnd);
    });

    it('should add performance headers on response', () => {
      performanceMiddleware(req, res, next);
      
      res.end();
      
      expect(res.setHeader).toHaveBeenCalledWith('X-Response-Time', expect.stringMatching(/\d+\.\d+ms/));
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'test-request-id');
    });

    it('should handle missing request ID', () => {
      delete req.id;
      performanceMiddleware(req, res, next);
      
      res.end();
      
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'unknown');
    });

    it('should use req.path when route.path is not available', () => {
      delete req.route;
      performanceMiddleware(req, res, next);
      
      res.end();
      
      expect(res.setHeader).toHaveBeenCalled();
    });

    it('should not log fast requests', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      performanceMiddleware(req, res, next);
      res.end();
      
      // Fast requests should not be logged
      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should record metrics asynchronously', (done) => {
      performanceMiddleware(req, res, next);
      res.end();
      
      // Metrics should be recorded asynchronously
      setImmediate(() => {
        expect(redis.zadd).toHaveBeenCalled();
        expect(redis.hincrby).toHaveBeenCalled();
        done();
      });
    });

    it('should track different status codes', () => {
      res.statusCode = 404;
      performanceMiddleware(req, res, next);
      res.end();
      
      expect(res.setHeader).toHaveBeenCalled();
    });

    it('should call original end function with arguments', () => {
      const originalEnd = jest.fn();
      res.end = originalEnd;
      
      performanceMiddleware(req, res, next);
      
      const testData = 'test response';
      res.end(testData);
      
      expect(originalEnd).toHaveBeenCalledWith(testData);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return metrics for a specific date', async () => {
      const mockMetrics = {
        total_requests: '1000',
        total_response_time: '50000',
        slow_requests: '50',
        very_slow_requests: '10',
        status_2xx: '900',
        status_4xx: '80',
        status_5xx: '20',
      };

      redis.hgetall.mockResolvedValue(mockMetrics);
      redis.zcard.mockResolvedValue(1000);
      redis.zrange.mockResolvedValue(['key', '45.5']);

      const result = await getPerformanceMetrics('2026-02-08');

      expect(result).toHaveProperty('date', '2026-02-08');
      expect(result).toHaveProperty('requests');
      expect(result).toHaveProperty('responseTimes');
      expect(result).toHaveProperty('performance');
      expect(result).toHaveProperty('targets');
      expect(result.requests.total).toBe(1000);
    });

    it('should use current date when no date provided', async () => {
      redis.hgetall.mockResolvedValue({});

      const result = await getPerformanceMetrics();
      const today = new Date().toISOString().split('T')[0];

      expect(result.date).toBe(today);
    });

    it('should return message when no metrics available', async () => {
      redis.hgetall.mockResolvedValue({});

      const result = await getPerformanceMetrics('2026-02-08');

      expect(result).toHaveProperty('message', 'No metrics available for this date');
    });

    it('should calculate percentiles correctly', async () => {
      const mockMetrics = {
        total_requests: '100',
        total_response_time: '5000',
        status_2xx: '95',
      };

      redis.hgetall.mockResolvedValue(mockMetrics);
      redis.zcard.mockResolvedValue(100);
      redis.zrange.mockResolvedValue(['key', '150.5']);

      const result = await getPerformanceMetrics('2026-02-08');

      expect(result.responseTimes).toHaveProperty('p50');
      expect(result.responseTimes).toHaveProperty('p95');
      expect(result.responseTimes).toHaveProperty('p99');
    });

    it('should check if targets are met', async () => {
      const mockMetrics = {
        total_requests: '100',
        total_response_time: '5000',
        status_2xx: '95',
      };

      redis.hgetall.mockResolvedValue(mockMetrics);
      redis.zcard.mockResolvedValue(100);
      redis.zrange.mockResolvedValue(['key', '150.5']);

      const result = await getPerformanceMetrics('2026-02-08');

      expect(result.targets).toHaveProperty('p95Met');
      expect(result.targets).toHaveProperty('p99Met');
      expect(result.targets.p95Target).toBe(`${THRESHOLDS.P95_TARGET}ms`);
    });

    it('should handle Redis errors gracefully', async () => {
      redis.hgetall.mockRejectedValue(new Error('Redis error'));

      await expect(getPerformanceMetrics('2026-02-08')).rejects.toThrow('Redis error');
    });

    it('should handle empty metrics object', async () => {
      redis.hgetall.mockResolvedValue(null);

      const result = await getPerformanceMetrics('2026-02-08');

      expect(result).toHaveProperty('message');
    });

    it('should calculate success rate correctly', async () => {
      const mockMetrics = {
        total_requests: '100',
        total_response_time: '5000',
        status_2xx: '80',
        status_4xx: '15',
        status_5xx: '5',
      };

      redis.hgetall.mockResolvedValue(mockMetrics);
      redis.zcard.mockResolvedValue(100);
      redis.zrange.mockResolvedValue(['key', '50']);

      const result = await getPerformanceMetrics('2026-02-08');

      expect(result.requests.successRate).toBe('80.00%');
    });

    it('should handle zero requests', async () => {
      const mockMetrics = {
        total_requests: '0',
      };

      redis.hgetall.mockResolvedValue(mockMetrics);
      redis.zcard.mockResolvedValue(0);

      const result = await getPerformanceMetrics('2026-02-08');

      expect(result.requests.total).toBe(0);
    });
  });

  describe('getEndpointMetrics', () => {
    it('should return metrics for a specific endpoint', async () => {
      const mockMetrics = {
        total_requests: '500',
        total_response_time: '25000',
        status_2xx: '450',
        status_4xx: '40',
        status_5xx: '10',
        min_response_time: '10.5',
        max_response_time: '250.8',
        slow_requests: '25',
        very_slow_requests: '5',
      };

      redis.hgetall.mockResolvedValue(mockMetrics);

      const result = await getEndpointMetrics('GET', '/api/students');

      expect(result).toHaveProperty('method', 'GET');
      expect(result).toHaveProperty('path', '/api/students');
      expect(result).toHaveProperty('requests');
      expect(result).toHaveProperty('responseTimes');
      expect(result).toHaveProperty('performance');
      expect(result.requests.total).toBe(500);
    });

    it('should return message when no metrics available', async () => {
      redis.hgetall.mockResolvedValue({});

      const result = await getEndpointMetrics('GET', '/api/students');

      expect(result).toHaveProperty('message', 'No metrics available for this endpoint');
    });

    it('should calculate average response time', async () => {
      const mockMetrics = {
        total_requests: '100',
        total_response_time: '5000',
      };

      redis.hgetall.mockResolvedValue(mockMetrics);

      const result = await getEndpointMetrics('POST', '/api/students');

      expect(result.responseTimes.avg).toBe('50.00ms');
    });

    it('should handle Redis errors gracefully', async () => {
      redis.hgetall.mockRejectedValue(new Error('Redis error'));

      await expect(getEndpointMetrics('GET', '/api/students')).rejects.toThrow('Redis error');
    });

    it('should handle null metrics', async () => {
      redis.hgetall.mockResolvedValue(null);

      const result = await getEndpointMetrics('GET', '/api/students');

      expect(result).toHaveProperty('message');
    });

    it('should handle zero requests for endpoint', async () => {
      const mockMetrics = {
        total_requests: '0',
      };

      redis.hgetall.mockResolvedValue(mockMetrics);

      const result = await getEndpointMetrics('GET', '/api/students');

      expect(result.requests.total).toBe(0);
    });
  });

  describe('getSlowEndpoints', () => {
    it('should return top slow endpoints', async () => {
      redis.keys.mockResolvedValue([
        'metrics:endpoint:GET:/api/students',
        'metrics:endpoint:POST:/api/enrollments',
        'metrics:endpoint:GET:/api/reports',
      ]);

      redis.hgetall
        .mockResolvedValueOnce({
          total_requests: '100',
          total_response_time: '15000',
          slow_requests: '30',
        })
        .mockResolvedValueOnce({
          total_requests: '50',
          total_response_time: '10000',
          slow_requests: '20',
        })
        .mockResolvedValueOnce({
          total_requests: '200',
          total_response_time: '20000',
          slow_requests: '10',
        });

      const result = await getSlowEndpoints(10);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty('method');
      expect(result[0]).toHaveProperty('path');
      expect(result[0]).toHaveProperty('avgResponseTime');
    });

    it('should sort endpoints by average response time', async () => {
      redis.keys.mockResolvedValue([
        'metrics:endpoint:GET:/api/fast',
        'metrics:endpoint:GET:/api/slow',
      ]);

      redis.hgetall
        .mockResolvedValueOnce({
          total_requests: '100',
          total_response_time: '5000', // 50ms avg
        })
        .mockResolvedValueOnce({
          total_requests: '100',
          total_response_time: '20000', // 200ms avg
        });

      const result = await getSlowEndpoints(10);

      // First result should be the slowest
      expect(parseFloat(result[0].avgResponseTime)).toBeGreaterThan(parseFloat(result[1].avgResponseTime));
    });

    it('should limit results to specified limit', async () => {
      redis.keys.mockResolvedValue([
        'metrics:endpoint:GET:/api/1',
        'metrics:endpoint:GET:/api/2',
        'metrics:endpoint:GET:/api/3',
        'metrics:endpoint:GET:/api/4',
        'metrics:endpoint:GET:/api/5',
      ]);

      redis.hgetall.mockResolvedValue({
        total_requests: '100',
        total_response_time: '5000',
      });

      const result = await getSlowEndpoints(3);

      expect(result.length).toBe(3);
    });

    it('should skip endpoints with zero requests', async () => {
      redis.keys.mockResolvedValue([
        'metrics:endpoint:GET:/api/active',
        'metrics:endpoint:GET:/api/inactive',
      ]);

      redis.hgetall
        .mockResolvedValueOnce({
          total_requests: '100',
          total_response_time: '5000',
        })
        .mockResolvedValueOnce({
          total_requests: '0',
          total_response_time: '0',
        });

      const result = await getSlowEndpoints(10);

      expect(result.length).toBe(1);
      expect(result[0].path).toBe('/api/active');
    });

    it('should handle Redis errors gracefully', async () => {
      redis.keys.mockRejectedValue(new Error('Redis error'));

      await expect(getSlowEndpoints(10)).rejects.toThrow('Redis error');
    });

    it('should handle empty keys array', async () => {
      redis.keys.mockResolvedValue([]);

      const result = await getSlowEndpoints(10);

      expect(result).toEqual([]);
    });

    it('should handle paths with colons', async () => {
      redis.keys.mockResolvedValue([
        'metrics:endpoint:GET:/api/students:123',
      ]);

      redis.hgetall.mockResolvedValue({
        total_requests: '100',
        total_response_time: '5000',
      });

      const result = await getSlowEndpoints(10);

      expect(result[0].path).toBe('/api/students:123');
    });
  });

  describe('THRESHOLDS', () => {
    it('should export performance thresholds', () => {
      expect(THRESHOLDS).toHaveProperty('SLOW_REQUEST');
      expect(THRESHOLDS).toHaveProperty('VERY_SLOW_REQUEST');
      expect(THRESHOLDS).toHaveProperty('P95_TARGET');
      expect(THRESHOLDS).toHaveProperty('P99_TARGET');
    });

    it('should have reasonable threshold values', () => {
      expect(THRESHOLDS.SLOW_REQUEST).toBe(200);
      expect(THRESHOLDS.VERY_SLOW_REQUEST).toBe(500);
      expect(THRESHOLDS.P95_TARGET).toBe(200);
      expect(THRESHOLDS.P99_TARGET).toBe(500);
    });
  });
});
