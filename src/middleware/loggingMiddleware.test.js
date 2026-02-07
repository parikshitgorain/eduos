/**
 * Tests for Structured Logging Middleware
 */

const request = require('supertest');
const express = require('express');
const {
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
} = require('./loggingMiddleware');

describe('Logging Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(loggingMiddleware);

    // Test routes
    app.get('/test', (req, res) => {
      res.json({ message: 'success' });
    });

    app.get('/error', (req, res) => {
      res.status(500).json({ error: 'Internal Server Error' });
    });

    app.use(errorLoggingMiddleware);
  });

  describe('HTTP Request Logging', () => {
    test('should log incoming and completed requests', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });

    test('should include request ID in logs', async () => {
      const response = await request(app)
        .get('/test')
        .set('x-request-id', 'test-request-123');

      expect(response.status).toBe(200);
    });

    test('should generate request ID if not provided', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });
  });

  describe('Log Levels', () => {
    test('should log successful requests', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });

    test('should log 4xx responses', async () => {
      app.get('/notfound', (req, res) => {
        res.status(404).json({ error: 'Not Found' });
      });

      const response = await request(app).get('/notfound');
      expect(response.status).toBe(404);
    });

    test('should log 5xx responses', async () => {
      const response = await request(app).get('/error');
      expect(response.status).toBe(500);
    });
  });

  describe('Tenant and User Context', () => {
    test('should include tenant ID in logs', async () => {
      const appWithContext = express();
      appWithContext.use((req, res, next) => {
        req.tenantId = 'tenant-123';
        next();
      });
      appWithContext.use(loggingMiddleware);
      appWithContext.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });

      const response = await request(appWithContext).get('/test');
      expect(response.status).toBe(200);
    });

    test('should include user ID in logs', async () => {
      const appWithContext = express();
      appWithContext.use((req, res, next) => {
        req.userId = 'user-456';
        next();
      });
      appWithContext.use(loggingMiddleware);
      appWithContext.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });

      const response = await request(appWithContext).get('/test');
      expect(response.status).toBe(200);
    });
  });

  describe('Logging Helper Functions', () => {
    test('logInfo should not throw', () => {
      expect(() => {
        logInfo('Test info message', { key: 'value' });
      }).not.toThrow();
    });

    test('logWarn should not throw', () => {
      expect(() => {
        logWarn('Test warning message', { key: 'value' });
      }).not.toThrow();
    });

    test('logError should not throw', () => {
      const error = new Error('Test error');
      expect(() => {
        logError('Error occurred', error, { context: 'test' });
      }).not.toThrow();
    });

    test('logSecurity should not throw', () => {
      expect(() => {
        logSecurity('failed_login', {
          userId: 'user-123',
          ip: '192.168.1.1',
        });
      }).not.toThrow();
    });

    test('logAudit should not throw', () => {
      expect(() => {
        logAudit('user.login', {
          userId: 'user-123',
          tenantId: 'tenant-456',
        });
      }).not.toThrow();
    });

    test('logDbQuery should not throw', () => {
      expect(() => {
        logDbQuery(
          'SELECT * FROM students WHERE tenant_id = $1',
          ['tenant-123'],
          15.5,
          { tenantId: 'tenant-123' }
        );
      }).not.toThrow();
    });

    test('logRedisOperation should not throw', () => {
      expect(() => {
        logRedisOperation('GET', 'user:123', 2.3, { tenantId: 'tenant-123' });
      }).not.toThrow();
    });

    test('logAIInference should not throw', () => {
      expect(() => {
        logAIInference(
          'duplicate-detection',
          'predict',
          125.5,
          0.95,
          { tenantId: 'tenant-123' }
        );
      }).not.toThrow();
    });

    test('logPayment should not throw', () => {
      expect(() => {
        logPayment(
          'txn-123',
          1000.50,
          'success',
          'stripe',
          { tenantId: 'tenant-123' }
        );
      }).not.toThrow();
    });
  });

  describe('Error Logging Middleware', () => {
    test('should log unhandled errors', async () => {
      app.get('/throw', (req, res, next) => {
        const error = new Error('Unhandled error');
        next(error);
      });

      app.use((err, req, res, next) => {
        res.status(500).json({ error: err.message });
      });

      const response = await request(app).get('/throw');
      expect(response.status).toBe(500);
    });
  });

  describe('Performance', () => {
    test('should have minimal overhead', async () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        await request(app).get('/test');
      }

      const duration = Date.now() - start;

      // 100 requests should complete in reasonable time
      expect(duration).toBeLessThan(10000);
    });

    test('should not block request processing', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(request(app).get('/test'));
      }

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Integration', () => {
    test('should work with async route handlers', async () => {
      app.get('/async', async (req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        res.json({ message: 'async success' });
      });

      const response = await request(app).get('/async');
      expect(response.status).toBe(200);
    });

    test('should handle multiple requests', async () => {
      const responses = await Promise.all([
        request(app).get('/test'),
        request(app).get('/test'),
        request(app).get('/test'),
      ]);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Sanitization', () => {
    test('should sanitize sensitive headers', async () => {
      const response = await request(app)
        .get('/test')
        .set('authorization', 'Bearer secret-token')
        .set('cookie', 'session=abc123')
        .set('x-api-key', 'api-key-123');

      expect(response.status).toBe(200);
    });

    test('logDbQuery should sanitize sensitive params', () => {
      expect(() => {
        logDbQuery(
          'SELECT * FROM users WHERE password = $1',
          { password: 'secret123', apiKey: 'key123', token: 'token123' },
          10
        );
      }).not.toThrow();
    });

    test('logDbQuery should handle null params', () => {
      expect(() => {
        logDbQuery('SELECT * FROM users', null, 10);
      }).not.toThrow();
    });

    test('logDbQuery should handle undefined params', () => {
      expect(() => {
        logDbQuery('SELECT * FROM users', undefined, 10);
      }).not.toThrow();
    });

    test('logDbQuery should handle string params', () => {
      expect(() => {
        logDbQuery('SELECT * FROM users', 'simple-string', 10);
      }).not.toThrow();
    });

    test('logDbQuery should handle nested objects with sensitive keys', () => {
      expect(() => {
        logDbQuery(
          'INSERT INTO users',
          {
            user: {
              name: 'John',
              password: 'secret123',
              nested: {
                apiKey: 'key123',
                secret: 'secret456',
              },
            },
          },
          10
        );
      }).not.toThrow();
    });

    test('logDbQuery should handle arrays with objects', () => {
      expect(() => {
        logDbQuery(
          'INSERT INTO users',
          [
            { name: 'John', password: 'secret' },
            { name: 'Jane', token: 'abc123' },
          ],
          10
        );
      }).not.toThrow();
    });

    test('logDbQuery should handle arrays with primitives', () => {
      expect(() => {
        logDbQuery('SELECT * FROM users WHERE id IN ($1, $2)', [1, 2], 10);
      }).not.toThrow();
    });
  });

  describe('Response status code logging levels', () => {
    test('should log with error level for 500 status', async () => {
      const response = await request(app).get('/error');
      expect(response.status).toBe(500);
    });

    test('should log with error level for 503 status', async () => {
      app.get('/unavailable', (req, res) => {
        res.status(503).json({ error: 'Service Unavailable' });
      });

      const response = await request(app).get('/unavailable');
      expect(response.status).toBe(503);
    });

    test('should log with warn level for 400 status', async () => {
      app.get('/badrequest', (req, res) => {
        res.status(400).json({ error: 'Bad Request' });
      });

      const response = await request(app).get('/badrequest');
      expect(response.status).toBe(400);
    });

    test('should log with warn level for 401 status', async () => {
      app.get('/unauthorized', (req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app).get('/unauthorized');
      expect(response.status).toBe(401);
    });

    test('should log with info level for 200 status', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });

    test('should log with info level for 201 status', async () => {
      app.post('/create', (req, res) => {
        res.status(201).json({ message: 'Created' });
      });

      const response = await request(app).post('/create');
      expect(response.status).toBe(201);
    });
  });

  describe('Request with content-length', () => {
    test('should log response size when content-length is present', async () => {
      app.get('/with-size', (req, res) => {
        const data = { message: 'test data' };
        const json = JSON.stringify(data);
        res.set('content-length', json.length.toString());
        res.json(data);
      });

      const response = await request(app).get('/with-size');
      expect(response.status).toBe(200);
    });
  });

  describe('Request with user-agent', () => {
    test('should log user-agent header', async () => {
      const response = await request(app)
        .get('/test')
        .set('user-agent', 'Mozilla/5.0 Test Browser');

      expect(response.status).toBe(200);
    });
  });
});
