/**
 * EduOS Platform - Main Server
 * 
 * Express server with tenant context middleware integration
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('express-async-errors');
require('dotenv').config();

const { tenantContext } = require('./middleware/tenantContext');
const { healthCheck } = require('./config/database');
const { healthCheck: redisHealthCheck } = require('./config/redis');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration - restrict to allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Health check endpoint (no authentication required)
app.get('/health', async (req, res) => {
  const dbHealthy = await healthCheck();
  const redisHealthy = await redisHealthCheck();
  
  const isHealthy = dbHealthy && redisHealthy;
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
      redis: redisHealthy ? 'connected' : 'disconnected'
    }
  });
});

// Public routes (no tenant context required)
app.get('/', (req, res) => {
  res.json({
    name: 'EduOS Platform API',
    version: '1.0.0',
    status: 'running'
  });
});

// Tenant provisioning routes (no tenant context required - these create tenants)
const tenantRoutes = require('./routes/tenants');
app.use('/api/v1/tenants', tenantRoutes);

// Cache management routes (no tenant context required)
const cacheRoutes = require('./routes/cache');
app.use('/api/v1/cache', cacheRoutes);

// Authentication routes (no tenant context required - these create sessions)
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// Domain management routes (require tenant context)
const domainRoutes = require('./routes/domains');

// Hierarchy management routes (NO tenant context middleware - has its own)
const hierarchyRoutes = require('./routes/hierarchy');
app.use('/api/v1/hierarchy', hierarchyRoutes);

// Webhook routes (NO tenant context - webhooks come from external services)
// Must be registered BEFORE tenant context middleware
const webhookRoutes = require('./routes/webhooks');
app.use('/api/v1/webhooks', webhookRoutes);

// Apply tenant context middleware to all /api routes
app.use('/api', tenantContext);

// Protected API routes (require tenant context)
app.use('/api/v1/domains', domainRoutes);

// Enrollment management routes (require tenant context)
const enrollmentRoutes = require('./routes/enrollments');
app.use('/api/v1/enrollments', enrollmentRoutes);

// Schema management routes (require tenant context)
const schemaRoutes = require('./routes/schemas');
app.use('/api/v1/schemas', schemaRoutes);

// Field permissions routes (require tenant context)
const fieldPermissionsRoutes = require('./routes/fieldPermissions');
app.use('/api/v1', fieldPermissionsRoutes);

// Student management routes (require tenant context)
const studentRoutes = require('./routes/students');
app.use('/api/v1/students', studentRoutes);

// Duplicate review queue routes (require tenant context)
const duplicateReviewQueueRoutes = require('./routes/duplicateReviewQueue');
app.use('/api/v1/duplicate-review-queue', duplicateReviewQueueRoutes);

// Merge operations routes (require tenant context)
const mergeRoutes = require('./routes/merges');
app.use('/api/v1/merges', mergeRoutes);

// Approval queue routes (require tenant context)
const approvalQueueRoutes = require('./routes/approvalQueue');
app.use('/api/v1/approvals', approvalQueueRoutes);

// Payment routes (require tenant context)
const paymentRoutes = require('./routes/payments');
app.use('/api/v1/payments', paymentRoutes);

app.get('/api/students', async (req, res) => {
  // RLS automatically filters by tenant_id
  const result = await req.dbClient.query(
    'SELECT student_id, first_name, last_name, email, status FROM students WHERE status = $1',
    ['active']
  );
  
  res.json({
    tenant_id: req.tenant.id,
    students: result.rows,
    count: result.rowCount,
    overhead_ms: req.tenantContextOverhead
  });
});

app.get('/api/students/:studentId', async (req, res) => {
  const { studentId } = req.params;
  
  // RLS automatically ensures student belongs to current tenant
  const result = await req.dbClient.query(
    'SELECT * FROM students WHERE student_id = $1',
    [studentId]
  );
  
  if (result.rowCount === 0) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Student not found or does not belong to your tenant'
    });
  }
  
  res.json({
    tenant_id: req.tenant.id,
    student: result.rows[0]
  });
});

app.post('/api/students', async (req, res) => {
  const { first_name, last_name, email, date_of_birth } = req.body;
  
  // Validate required fields
  if (!first_name || !last_name || !email) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required fields: first_name, last_name, email'
    });
  }
  
  // Insert student - tenant_id is automatically set by RLS
  const result = await req.dbClient.query(
    `INSERT INTO students (tenant_id, first_name, last_name, email, date_of_birth, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING student_id, first_name, last_name, email, status, created_at`,
    [req.tenant.id, first_name, last_name, email, date_of_birth, 'active']
  );
  
  res.status(201).json({
    tenant_id: req.tenant.id,
    student: result.rows[0]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // PostgreSQL error codes
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Resource already exists'
    });
  }
  
  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid foreign key reference'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist'
  });
});

// Start server only if not in test mode
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, async () => {
    console.log(`EduOS Platform API listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    
    // Initialize authentication service
    try {
      const authService = require('./services/authService');
      await authService.initialize();
      console.log('Authentication service initialized');
    } catch (error) {
      console.error('Failed to initialize authentication service:', error.message);
    }
    
    // Start background jobs
    const { startJob } = require('./jobs/domainVerificationJob');
    startJob();
  });
  
  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutdown signal received: closing HTTP server');
    
    // Stop background jobs
    const { stopJob } = require('./jobs/domainVerificationJob');
    stopJob();
    
    // Close Redis connection
    const { close: closeRedis } = require('./config/redis');
    await closeRedis();
    
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;
