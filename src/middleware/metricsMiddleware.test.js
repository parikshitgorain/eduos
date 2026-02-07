/**
 * Tests for Prometheus Metrics Middleware
 */

const request = require('supertest');
const express = require('express');
const {
  metricsMiddleware,
  metricsHandler,
  recordStudentEnrollment,
  recordPayment,
  recordAttendance,
  recordDbQuery,
  recordRedisOperation,
  recordCacheHit,
  recordCacheMiss,
  recordAIInference,
  updateDbConnectionPool,
  register
} = require('./metricsMiddleware');

describe('Metrics Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(metricsMiddleware);

    // Test routes
    app.get('/test', (req, res) => {
      res.json({ message: 'success' });
    });

    app.get('/error', (req, res) => {
      res.status(500).json({ error: 'Internal Server Error' });
    });

    app.get('/metrics', metricsHandler);
  });

  describe('HTTP Metrics Collection', () => {
    test('should collect metrics for successful requests', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);

      // Check metrics endpoint
      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.text).toContain('http_requests_total');
      expect(metricsResponse.text).toContain('http_request_duration_seconds');
    });

    test('should collect metrics for error requests', async () => {
      const response = await request(app).get('/error');
      expect(response.status).toBe(500);

      // Check metrics endpoint
      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.text).toContain('http_requests_total');
      expect(metricsResponse.text).toContain('status="500"');
    });

    test('should track active requests', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);

      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.text).toContain('http_requests_active');
    });
  });

  describe('Metrics Endpoint', () => {
    test('should expose metrics in Prometheus format', async () => {
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    test('should include default Node.js metrics', async () => {
      const response = await request(app).get('/metrics');
      
      expect(response.text).toContain('eduos_process_cpu_user_seconds_total');
      expect(response.text).toContain('eduos_nodejs_heap_size_total_bytes');
    });

    test('should include custom HTTP metrics', async () => {
      // Make a test request first
      await request(app).get('/test');

      const response = await request(app).get('/metrics');
      
      expect(response.text).toContain('http_requests_total');
      expect(response.text).toContain('http_request_duration_seconds');
      expect(response.text).toContain('http_request_size_bytes');
      expect(response.text).toContain('http_response_size_bytes');
    });
  });

  describe('Business Metrics', () => {
    test('should record student enrollment metrics', () => {
      expect(() => {
        recordStudentEnrollment('tenant-123', 'Computer Science');
      }).not.toThrow();
    });

    test('should record payment metrics', () => {
      expect(() => {
        recordPayment('tenant-123', 'success', 'stripe');
      }).not.toThrow();
    });

    test('should expose business metrics in metrics endpoint', async () => {
      recordStudentEnrollment('tenant-123', 'Computer Science');
      recordPayment('tenant-456', 'success', 'razorpay');

      const response = await request(app).get('/metrics');
      
      expect(response.text).toContain('student_enrollments_total');
      expect(response.text).toContain('payments_processed_total');
    });
  });

  describe('Metric Labels', () => {
    test('should include tenant_id in metrics', async () => {
      // Create a new app with tenant middleware before metrics middleware
      const appWithTenant = express();
      
      // Add tenant middleware first
      appWithTenant.use((req, res, next) => {
        req.tenantId = 'test-tenant';
        next();
      });
      
      // Then add metrics middleware
      appWithTenant.use(metricsMiddleware);
      
      // Add test route
      appWithTenant.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });
      
      // Add metrics endpoint
      appWithTenant.get('/metrics', metricsHandler);

      // Make request with tenant context
      await request(appWithTenant).get('/test');

      const response = await request(appWithTenant).get('/metrics');
      expect(response.text).toContain('tenant_id="test-tenant"');
    });

    test('should include method and route in metrics', async () => {
      await request(app).get('/test');

      const response = await request(app).get('/metrics');
      expect(response.text).toContain('method="GET"');
      expect(response.text).toContain('route="/test"');
    });

    test('should include status code in metrics', async () => {
      await request(app).get('/test');
      await request(app).get('/error');

      const response = await request(app).get('/metrics');
      expect(response.text).toContain('status="200"');
      expect(response.text).toContain('status="500"');
    });
  });

  describe('Performance', () => {
    test('should have minimal overhead', async () => {
      const start = Date.now();
      
      for (let i = 0; i < 100; i++) {
        await request(app).get('/test');
      }
      
      const duration = Date.now() - start;
      
      // 100 requests should complete in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    test('should not block request processing', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(request(app).get('/test'));
      }
      
      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Database Metrics', () => {
    test('should record database query metrics', () => {
      expect(() => {
        recordDbQuery('SELECT', 'students', 'tenant-123', 0.025);
      }).not.toThrow();
    });

    test('should record database query with different operations', () => {
      expect(() => {
        recordDbQuery('INSERT', 'enrollments', 'tenant-456', 0.015);
        recordDbQuery('UPDATE', 'attendance', 'tenant-789', 0.010);
        recordDbQuery('DELETE', 'sessions', 'tenant-abc', 0.005);
      }).not.toThrow();
    });

    test('should expose database metrics in metrics endpoint', async () => {
      recordDbQuery('SELECT', 'students', 'tenant-123', 0.025);

      const response = await request(app).get('/metrics');
      expect(response.text).toContain('db_query_duration_seconds');
    });
  });

  describe('Redis Metrics', () => {
    test('should record Redis operation metrics', () => {
      expect(() => {
        recordRedisOperation('GET', 'session:*', 0.002);
      }).not.toThrow();
    });

    test('should record different Redis operations', () => {
      expect(() => {
        recordRedisOperation('SET', 'cache:*', 0.001);
        recordRedisOperation('DEL', 'temp:*', 0.0005);
        recordRedisOperation('HGET', 'user:*', 0.0015);
      }).not.toThrow();
    });

    test('should expose Redis metrics in metrics endpoint', async () => {
      recordRedisOperation('GET', 'session:*', 0.002);

      const response = await request(app).get('/metrics');
      expect(response.text).toContain('redis_operation_duration_seconds');
    });
  });

  describe('Cache Metrics', () => {
    test('should record cache hits', () => {
      expect(() => {
        recordCacheHit('redis', 'user:*');
      }).not.toThrow();
    });

    test('should record cache misses', () => {
      expect(() => {
        recordCacheMiss('redis', 'user:*');
      }).not.toThrow();
    });

    test('should record cache hits and misses for different cache types', () => {
      expect(() => {
        recordCacheHit('memory', 'config:*');
        recordCacheMiss('memory', 'config:*');
        recordCacheHit('redis', 'session:*');
        recordCacheMiss('redis', 'session:*');
      }).not.toThrow();
    });

    test('should expose cache metrics in metrics endpoint', async () => {
      recordCacheHit('redis', 'user:*');
      recordCacheMiss('redis', 'user:*');

      const response = await request(app).get('/metrics');
      expect(response.text).toContain('cache_hits_total');
      expect(response.text).toContain('cache_misses_total');
    });
  });

  describe('Business Metrics - Extended', () => {
    test('should record attendance metrics', () => {
      expect(() => {
        recordAttendance('tenant-123', 'present');
      }).not.toThrow();
    });

    test('should record attendance with different statuses', () => {
      expect(() => {
        recordAttendance('tenant-123', 'present');
        recordAttendance('tenant-123', 'absent');
        recordAttendance('tenant-456', 'late');
      }).not.toThrow();
    });

    test('should expose attendance metrics in metrics endpoint', async () => {
      recordAttendance('tenant-123', 'present');

      const response = await request(app).get('/metrics');
      expect(response.text).toContain('attendance_marked_total');
    });
  });

  describe('AI Metrics', () => {
    test('should record AI inference metrics', () => {
      expect(() => {
        recordAIInference('gpt-4', 'text-generation', 1.5);
      }).not.toThrow();
    });

    test('should record AI inference for different models and operations', () => {
      expect(() => {
        recordAIInference('gpt-4', 'text-generation', 1.5);
        recordAIInference('claude', 'summarization', 2.3);
        recordAIInference('bert', 'classification', 0.8);
      }).not.toThrow();
    });

    test('should expose AI inference metrics in metrics endpoint', async () => {
      recordAIInference('gpt-4', 'text-generation', 1.5);

      const response = await request(app).get('/metrics');
      expect(response.text).toContain('ai_inference_duration_seconds');
    });
  });

  describe('Database Connection Pool Metrics', () => {
    test('should update database connection pool metrics', () => {
      expect(() => {
        updateDbConnectionPool(5, 3, 2);
      }).not.toThrow();
    });

    test('should update connection pool with different values', () => {
      expect(() => {
        updateDbConnectionPool(10, 5, 0);
        updateDbConnectionPool(8, 7, 1);
        updateDbConnectionPool(0, 10, 5);
      }).not.toThrow();
    });

    test('should expose connection pool metrics in metrics endpoint', async () => {
      updateDbConnectionPool(5, 3, 2);

      const response = await request(app).get('/metrics');
      expect(response.text).toContain('db_connection_pool_size');
      expect(response.text).toContain('state="idle"');
      expect(response.text).toContain('state="active"');
      expect(response.text).toContain('state="waiting"');
    });
  });

  describe('Request Size Tracking', () => {
    test('should track request size when content-length is present', async () => {
      const appWithPost = express();
      appWithPost.use(express.json());
      appWithPost.use(metricsMiddleware);
      
      appWithPost.post('/data', (req, res) => {
        res.json({ received: true });
      });
      
      appWithPost.get('/metrics', metricsHandler);

      await request(appWithPost)
        .post('/data')
        .send({ name: 'test', data: 'sample' });

      const response = await request(appWithPost).get('/metrics');
      expect(response.text).toContain('http_request_size_bytes');
    });

    test('should track response size when content-length is present', async () => {
      const appWithResponse = express();
      appWithResponse.use(metricsMiddleware);
      
      appWithResponse.get('/large-response', (req, res) => {
        const largeData = { data: 'x'.repeat(1000) };
        res.json(largeData);
      });
      
      appWithResponse.get('/metrics', metricsHandler);

      await request(appWithResponse).get('/large-response');

      const response = await request(appWithResponse).get('/metrics');
      expect(response.text).toContain('http_response_size_bytes');
    });
  });

  describe('Error Handling', () => {
    test('should handle metrics endpoint errors gracefully', async () => {
      // Mock register.metrics to throw an error
      const originalMetrics = register.metrics;
      register.metrics = jest.fn().mockRejectedValue(new Error('Metrics error'));

      const response = await request(app).get('/metrics');
      expect(response.status).toBe(500);
      expect(response.text).toContain('Metrics error');

      // Restore original function
      register.metrics = originalMetrics;
    });
  });

  describe('Route Path Handling', () => {
    test('should handle requests without route.path', async () => {
      const appNoRoute = express();
      appNoRoute.use(metricsMiddleware);
      
      // Middleware that doesn't set route
      appNoRoute.use('/dynamic', (req, res) => {
        res.json({ path: req.path });
      });
      
      appNoRoute.get('/metrics', metricsHandler);

      const response = await request(appNoRoute).get('/dynamic/test');
      expect(response.status).toBe(200);

      const metricsResponse = await request(appNoRoute).get('/metrics');
      expect(metricsResponse.text).toContain('http_requests_total');
    });
  });
});
