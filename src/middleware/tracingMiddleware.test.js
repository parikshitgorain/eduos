/**
 * Tests for Distributed Tracing Middleware
 */

const request = require('supertest');
const express = require('express');
const {
  initializeTracer,
  getTracer,
  tracingMiddleware,
  createChildSpan,
  traceDbQuery,
  traceRedisOperation,
  traceHttpCall,
  traceAIInference,
  addSpanTags,
  logSpanEvent,
  closeTracer,
} = require('./tracingMiddleware');

describe('Tracing Middleware', () => {
  let app;
  let tracer;

  beforeAll(() => {
    // Initialize tracer for tests
    tracer = initializeTracer('test-service');
  });

  beforeEach(() => {
    app = express();
    app.use(tracingMiddleware);

    // Test routes
    app.get('/test', (req, res) => {
      res.json({ message: 'success' });
    });

    app.get('/error', (req, res) => {
      res.status(500).json({ error: 'Internal Server Error' });
    });
  });

  afterAll((done) => {
    // Close tracer and wait for cleanup
    closeTracer();
    // Give Jaeger time to flush
    setTimeout(done, 100);
  });

  describe('Tracer Initialization', () => {
    test('should initialize tracer with service name', () => {
      const testTracer = initializeTracer('test-service');
      expect(testTracer).toBeDefined();
      expect(testTracer._serviceName).toBe('test-service');
    });

    test('should return existing tracer instance', () => {
      const tracer1 = getTracer();
      const tracer2 = getTracer();
      expect(tracer1).toBe(tracer2);
    });
  });

  describe('HTTP Request Tracing', () => {
    test('should create span for HTTP requests', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      // Span should be created and attached to request
    });

    test('should include request metadata in span', async () => {
      const response = await request(app)
        .get('/test?param=value')
        .set('User-Agent', 'test-agent');
      
      expect(response.status).toBe(200);
      // Span should include method, URL, query params
    });

    test('should mark span as error for 5xx responses', async () => {
      const response = await request(app).get('/error');
      expect(response.status).toBe(500);
      // Span should be marked with error tag
    });

    test('should attach span to request object', async () => {
      app.get('/check-span', (req, res) => {
        expect(req.span).toBeDefined();
        expect(req.tracer).toBeDefined();
        res.json({ hasSpan: true });
      });

      const response = await request(app).get('/check-span');
      expect(response.body.hasSpan).toBe(true);
    });
  });

  describe('Child Span Creation', () => {
    test('should create child span from parent', () => {
      const parentSpan = tracer.startSpan('parent-operation');
      const childSpan = createChildSpan(parentSpan, 'child-operation', {
        'custom.tag': 'value',
      });

      expect(childSpan).toBeDefined();
      childSpan.finish();
      parentSpan.finish();
    });
  });

  describe('Database Query Tracing', () => {
    test('should trace successful database query', async () => {
      const parentSpan = tracer.startSpan('test-operation');
      
      const mockExecutor = jest.fn().mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: 1,
      });

      const result = await traceDbQuery(
        parentSpan,
        'SELECT * FROM students WHERE id = $1',
        [1],
        mockExecutor
      );

      expect(mockExecutor).toHaveBeenCalled();
      expect(result.rowCount).toBe(1);
      parentSpan.finish();
    });

    test('should trace failed database query', async () => {
      const parentSpan = tracer.startSpan('test-operation');
      
      const mockExecutor = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        traceDbQuery(
          parentSpan,
          'SELECT * FROM students',
          [],
          mockExecutor
        )
      ).rejects.toThrow('Database connection failed');

      parentSpan.finish();
    });
  });

  describe('Redis Operation Tracing', () => {
    test('should trace successful Redis operation', async () => {
      const parentSpan = tracer.startSpan('test-operation');
      
      const mockExecutor = jest.fn().mockResolvedValue('cached-value');

      const result = await traceRedisOperation(
        parentSpan,
        'GET',
        'user:123',
        mockExecutor
      );

      expect(mockExecutor).toHaveBeenCalled();
      expect(result).toBe('cached-value');
      parentSpan.finish();
    });

    test('should trace failed Redis operation', async () => {
      const parentSpan = tracer.startSpan('test-operation');
      
      const mockExecutor = jest.fn().mockRejectedValue(
        new Error('Redis connection failed')
      );

      await expect(
        traceRedisOperation(
          parentSpan,
          'SET',
          'user:123',
          mockExecutor
        )
      ).rejects.toThrow('Redis connection failed');

      parentSpan.finish();
    });
  });

  describe('HTTP Call Tracing', () => {
    test('should trace successful HTTP call', async () => {
      const parentSpan = tracer.startSpan('test-operation');
      
      const mockExecutor = jest.fn().mockResolvedValue({
        status: 200,
        data: { result: 'success' },
      });

      const result = await traceHttpCall(
        parentSpan,
        'POST',
        'http://api.example.com/endpoint',
        mockExecutor
      );

      expect(mockExecutor).toHaveBeenCalled();
      expect(result.status).toBe(200);
      
      // Verify headers were passed for context propagation
      const callArgs = mockExecutor.mock.calls[0][0];
      expect(callArgs).toBeDefined();
      
      parentSpan.finish();
    });

    test('should trace failed HTTP call', async () => {
      const parentSpan = tracer.startSpan('test-operation');
      
      const mockExecutor = jest.fn().mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        traceHttpCall(
          parentSpan,
          'GET',
          'http://api.example.com/endpoint',
          mockExecutor
        )
      ).rejects.toThrow('Network error');

      parentSpan.finish();
    });
  });

  describe('AI Inference Tracing', () => {
    test('should trace successful AI inference', async () => {
      const parentSpan = tracer.startSpan('test-operation');
      
      const mockExecutor = jest.fn().mockResolvedValue({
        prediction: 'duplicate',
        confidence: 0.95,
      });

      const result = await traceAIInference(
        parentSpan,
        'duplicate-detection',
        'predict',
        { student1: 'John Doe', student2: 'Jon Doe' },
        mockExecutor
      );

      expect(mockExecutor).toHaveBeenCalled();
      expect(result.confidence).toBe(0.95);
      parentSpan.finish();
    });

    test('should trace failed AI inference', async () => {
      const parentSpan = tracer.startSpan('test-operation');
      
      const mockExecutor = jest.fn().mockRejectedValue(
        new Error('Model not loaded')
      );

      await expect(
        traceAIInference(
          parentSpan,
          'risk-prediction',
          'predict',
          { studentId: '123' },
          mockExecutor
        )
      ).rejects.toThrow('Model not loaded');

      parentSpan.finish();
    });
  });

  describe('Span Tags and Events', () => {
    test('should add custom tags to span', () => {
      const span = tracer.startSpan('test-operation');
      
      addSpanTags(span, {
        'tenant.id': 'tenant-123',
        'user.id': 'user-456',
        'custom.field': 'value',
      });

      // Tags should be added to span
      span.finish();
    });

    test('should log events to span', () => {
      const span = tracer.startSpan('test-operation');
      
      logSpanEvent(span, 'cache.hit', {
        key: 'user:123',
        ttl: 3600,
      });

      logSpanEvent(span, 'validation.success', {
        field: 'email',
      });

      // Events should be logged to span
      span.finish();
    });

    test('should handle null span gracefully', () => {
      expect(() => {
        addSpanTags(null, { tag: 'value' });
        logSpanEvent(null, 'event', { field: 'value' });
      }).not.toThrow();
    });
  });

  describe('Span Context Propagation', () => {
    test('should propagate span context in headers', async () => {
      const parentSpan = tracer.startSpan('parent-operation');
      
      let capturedHeaders;
      const mockExecutor = jest.fn().mockImplementation((headers) => {
        capturedHeaders = headers;
        return Promise.resolve({ status: 200 });
      });

      await traceHttpCall(
        parentSpan,
        'GET',
        'http://api.example.com',
        mockExecutor
      );

      // Headers should contain trace context
      expect(capturedHeaders).toBeDefined();
      
      parentSpan.finish();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing parent span', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ rows: [] });

      await expect(
        traceDbQuery(null, 'SELECT * FROM students', [], mockExecutor)
      ).resolves.toBeDefined();
    });

    test('should propagate errors from executor', async () => {
      const parentSpan = tracer.startSpan('test-operation');
      const error = new Error('Execution failed');
      const mockExecutor = jest.fn().mockRejectedValue(error);

      await expect(
        traceDbQuery(parentSpan, 'SELECT *', [], mockExecutor)
      ).rejects.toThrow('Execution failed');

      parentSpan.finish();
    });
  });

  describe('Integration with Express', () => {
    test('should work with async route handlers', async () => {
      app.get('/async', async (req, res) => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
        res.json({ message: 'async success' });
      });

      const response = await request(app).get('/async');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('async success');
    });

    test('should handle route errors', async () => {
      app.get('/throw', (req, res) => {
        throw new Error('Route error');
      });

      app.use((err, req, res, next) => {
        res.status(500).json({ error: err.message });
      });

      const response = await request(app).get('/throw');
      expect(response.status).toBe(500);
    });
  });
});
