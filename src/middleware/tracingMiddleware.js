/**
 * Distributed Tracing Middleware for EduOS Platform
 * Integrates with Jaeger for request tracing across microservices
 */

const { initTracer, opentracing } = require('jaeger-client');

// Initialize Jaeger tracer
let tracer = null;

/**
 * Initialize the Jaeger tracer
 */
function initializeTracer(serviceName = 'eduos-api') {
  const config = {
    serviceName,
    sampler: {
      type: process.env.JAEGER_SAMPLER_TYPE || 'probabilistic',
      param: parseFloat(process.env.JAEGER_SAMPLER_PARAM || '0.1'),
    },
    reporter: {
      logSpans: process.env.NODE_ENV === 'development',
      agentHost: process.env.JAEGER_AGENT_HOST || 'jaeger',
      agentPort: parseInt(process.env.JAEGER_AGENT_PORT || '6831', 10),
      collectorEndpoint: process.env.JAEGER_COLLECTOR_ENDPOINT,
      flushIntervalMs: 1000,
    },
  };

  const options = {
    tags: {
      'eduos.version': process.env.APP_VERSION || '1.0.0',
      'eduos.environment': process.env.NODE_ENV || 'development',
    },
    logger: {
      info: (msg) => console.log('[Jaeger]', msg),
      error: (msg) => console.error('[Jaeger]', msg),
    },
  };

  tracer = initTracer(config, options);
  return tracer;
}

/**
 * Get the current tracer instance
 */
function getTracer() {
  if (!tracer) {
    tracer = initializeTracer();
  }
  return tracer;
}

/**
 * Middleware to create a span for each HTTP request
 */
function tracingMiddleware(req, res, next) {
  const tracer = getTracer();
  
  // Extract parent span context from headers (if exists)
  const parentSpanContext = tracer.extract(
    opentracing.FORMAT_HTTP_HEADERS,
    req.headers
  );

  // Create a new span for this request
  const span = tracer.startSpan(
    `${req.method} ${req.route?.path || req.path}`,
    {
      childOf: parentSpanContext,
      tags: {
        [opentracing.Tags.SPAN_KIND]: opentracing.Tags.SPAN_KIND_RPC_SERVER,
        [opentracing.Tags.HTTP_METHOD]: req.method,
        [opentracing.Tags.HTTP_URL]: req.originalUrl,
        'http.path': req.path,
        'http.query': JSON.stringify(req.query),
        'tenant.id': req.tenantId || 'unknown',
        'user.id': req.userId || 'anonymous',
      },
    }
  );

  // Store span in request for use in route handlers
  req.span = span;
  req.tracer = tracer;

  // Override res.end to finish the span
  const originalEnd = res.end;
  res.end = function (...args) {
    // Add response tags
    span.setTag(opentracing.Tags.HTTP_STATUS_CODE, res.statusCode);
    
    // Mark as error if status code >= 500
    if (res.statusCode >= 500) {
      span.setTag(opentracing.Tags.ERROR, true);
      span.log({
        event: 'error',
        'error.kind': 'ServerError',
        message: `HTTP ${res.statusCode}`,
      });
    }

    // Finish the span
    span.finish();

    // Call original end
    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Create a child span for a specific operation
 */
function createChildSpan(parentSpan, operationName, tags = {}) {
  const tracer = getTracer();
  return tracer.startSpan(operationName, {
    childOf: parentSpan,
    tags,
  });
}

/**
 * Trace a database query
 */
async function traceDbQuery(parentSpan, query, params, executor) {
  const span = createChildSpan(parentSpan, 'db.query', {
    [opentracing.Tags.DB_TYPE]: 'postgresql',
    [opentracing.Tags.DB_STATEMENT]: query,
    'db.params': JSON.stringify(params),
  });

  try {
    const result = await executor();
    span.setTag('db.rows_affected', result.rowCount || 0);
    return result;
  } catch (error) {
    span.setTag(opentracing.Tags.ERROR, true);
    span.log({
      event: 'error',
      'error.object': error,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    span.finish();
  }
}

/**
 * Trace a Redis operation
 */
async function traceRedisOperation(parentSpan, operation, key, executor) {
  const span = createChildSpan(parentSpan, 'redis.operation', {
    [opentracing.Tags.DB_TYPE]: 'redis',
    'redis.operation': operation,
    'redis.key': key,
  });

  try {
    const result = await executor();
    span.setTag('redis.result', typeof result === 'string' ? result : JSON.stringify(result));
    return result;
  } catch (error) {
    span.setTag(opentracing.Tags.ERROR, true);
    span.log({
      event: 'error',
      'error.object': error,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    span.finish();
  }
}

/**
 * Trace an HTTP call to another service
 */
async function traceHttpCall(parentSpan, method, url, executor) {
  const tracer = getTracer();
  const span = createChildSpan(parentSpan, `http.${method.toLowerCase()}`, {
    [opentracing.Tags.SPAN_KIND]: opentracing.Tags.SPAN_KIND_RPC_CLIENT,
    [opentracing.Tags.HTTP_METHOD]: method,
    [opentracing.Tags.HTTP_URL]: url,
  });

  // Inject span context into headers for propagation
  const headers = {};
  tracer.inject(span, opentracing.FORMAT_HTTP_HEADERS, headers);

  try {
    const result = await executor(headers);
    span.setTag(opentracing.Tags.HTTP_STATUS_CODE, result.status || result.statusCode);
    return result;
  } catch (error) {
    span.setTag(opentracing.Tags.ERROR, true);
    span.log({
      event: 'error',
      'error.object': error,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    span.finish();
  }
}

/**
 * Trace an AI inference operation
 */
async function traceAIInference(parentSpan, model, operation, input, executor) {
  const span = createChildSpan(parentSpan, 'ai.inference', {
    'ai.model': model,
    'ai.operation': operation,
    'ai.input_size': JSON.stringify(input).length,
  });

  try {
    const result = await executor();
    span.setTag('ai.confidence', result.confidence || 0);
    span.setTag('ai.output_size', JSON.stringify(result).length);
    return result;
  } catch (error) {
    span.setTag(opentracing.Tags.ERROR, true);
    span.log({
      event: 'error',
      'error.object': error,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    span.finish();
  }
}

/**
 * Add custom tags to the current span
 */
function addSpanTags(span, tags) {
  if (span && tags) {
    Object.entries(tags).forEach(([key, value]) => {
      span.setTag(key, value);
    });
  }
}

/**
 * Log an event in the current span
 */
function logSpanEvent(span, event, fields = {}) {
  if (span) {
    span.log({
      event,
      ...fields,
    });
  }
}

/**
 * Close the tracer (call on application shutdown)
 */
function closeTracer() {
  if (tracer) {
    tracer.close();
  }
}

module.exports = {
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
};
