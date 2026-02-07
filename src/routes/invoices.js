/**
 * Invoice Routes
 * 
 * API endpoints for invoice generation and management
 */

const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'eduos',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

/**
 * POST /api/v1/invoices
 * Generate a new invoice
 */
router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      tenant_id,
      student_id,
      payment_id,
      line_items,
      tax_details,
      discount_details,
      notes,
      due_date,
    } = req.body;

    // Validate required fields
    if (!tenant_id || !student_id || !line_items) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['tenant_id', 'student_id', 'line_items'],
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    // Generate invoice
    const invoice = await paymentService.generateInvoice({
      tenantId: tenant_id,
      studentId: student_id,
      paymentId: payment_id,
      lineItems: line_items,
      taxDetails: tax_details,
      discountDetails: discount_details,
      notes,
      dueDate: due_date,
    }, client);

    res.status(201).json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      error: 'Failed to generate invoice',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/invoices/:id
 * Get invoice by ID
 */
router.get('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const invoice = await paymentService.getInvoice(id, tenant_id, client);

    res.json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    
    if (error.message === 'Invoice not found') {
      return res.status(404).json({
        error: 'Invoice not found',
      });
    }

    res.status(500).json({
      error: 'Failed to fetch invoice',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/invoices/number/:invoice_number
 * Get invoice by invoice number
 */
router.get('/number/:invoice_number', async (req, res) => {
  const client = await pool.connect();

  try {
    const { invoice_number } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const invoice = await paymentService.getInvoiceByNumber(invoice_number, tenant_id, client);

    res.json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    
    if (error.message === 'Invoice not found') {
      return res.status(404).json({
        error: 'Invoice not found',
      });
    }

    res.status(500).json({
      error: 'Failed to fetch invoice',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/invoices
 * List invoices for a student or tenant
 */
router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, student_id, status, limit, offset } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const invoices = await paymentService.listInvoices(
      student_id,
      tenant_id,
      client,
      {
        status,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0,
      }
    );

    res.json({
      success: true,
      invoices,
      count: invoices.length,
    });
  } catch (error) {
    console.error('Error listing invoices:', error);
    res.status(500).json({
      error: 'Failed to list invoices',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/v1/invoices/:id/status
 * Update invoice status
 */
router.patch('/:id/status', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { tenant_id, status } = req.body;

    if (!tenant_id || !status) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['tenant_id', 'status'],
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const invoice = await paymentService.updateInvoiceStatus(id, status, tenant_id, client);

    res.json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error('Error updating invoice status:', error);
    
    if (error.message === 'Invoice not found') {
      return res.status(404).json({
        error: 'Invoice not found',
      });
    }

    res.status(500).json({
      error: 'Failed to update invoice status',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/invoices/:id/pdf
 * Generate and download invoice PDF
 */
router.get('/:id/pdf', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const pdfBuffer = await paymentService.generateInvoicePDF(id, tenant_id, client);

    // Get invoice for filename
    const invoice = await paymentService.getInvoice(id, tenant_id, client);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    
    if (error.message === 'Invoice not found') {
      return res.status(404).json({
        error: 'Invoice not found',
      });
    }

    res.status(500).json({
      error: 'Failed to generate invoice PDF',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/invoices/gaps/detect
 * Detect gaps in invoice sequence
 */
router.get('/gaps/detect', async (req, res) => {
  const client = await pool.connect();

  try {
    const { tenant_id, year, month } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        error: 'Missing required parameter: tenant_id',
      });
    }

    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenant_id}'`);

    const gaps = await paymentService.detectInvoiceGaps(
      tenant_id,
      client,
      year ? parseInt(year) : null,
      month ? parseInt(month) : null
    );

    res.json({
      success: true,
      gaps,
      has_gaps: gaps.length > 0,
      count: gaps.length,
    });
  } catch (error) {
    console.error('Error detecting invoice gaps:', error);
    res.status(500).json({
      error: 'Failed to detect invoice gaps',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
