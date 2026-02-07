/**
 * Invoice Routes Tests
 * 
 * Tests for invoice API endpoints
 */

const request = require('supertest');
const express = require('express');
const invoiceRoutes = require('./invoices');
const paymentService = require('../services/paymentService');

// Mock payment service
jest.mock('../services/paymentService');

// Mock pg Pool
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  const mockPool = {
    connect: jest.fn(() => Promise.resolve(mockClient)),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mockPool) };
});

const app = express();
app.use(express.json());
app.use('/api/v1/invoices', invoiceRoutes);

describe('Invoice Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/invoices', () => {
    it('should generate a new invoice', async () => {
      const mockInvoice = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        student_id: '123e4567-e89b-12d3-a456-426614174001',
        invoice_number: 'INV-2026-02-0001',
        status: 'issued',
        total_amount: 70800,
      };

      paymentService.generateInvoice.mockResolvedValue(mockInvoice);

      const response = await request(app)
        .post('/api/v1/invoices')
        .send({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          student_id: '123e4567-e89b-12d3-a456-426614174001',
          line_items: [
            { description: 'Tuition Fee', quantity: 1, unit_price: 50000 },
          ],
          tax_details: { cgst: 9, sgst: 9 },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.invoice).toBeDefined();
      expect(response.body.invoice.invoice_number).toBe('INV-2026-02-0001');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .send({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          // Missing student_id and line_items
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
    });

    it('should return 500 if invoice generation fails', async () => {
      paymentService.generateInvoice.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/invoices')
        .send({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          student_id: '123e4567-e89b-12d3-a456-426614174001',
          line_items: [
            { description: 'Tuition Fee', quantity: 1, unit_price: 50000 },
          ],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to generate invoice');
    });
  });

  describe('GET /api/v1/invoices/:id', () => {
    it('should retrieve invoice by ID', async () => {
      const mockInvoice = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        invoice_number: 'INV-2026-02-0001',
        status: 'issued',
      };

      paymentService.getInvoice.mockResolvedValue(mockInvoice);

      const response = await request(app)
        .get('/api/v1/invoices/123e4567-e89b-12d3-a456-426614174002')
        .query({ tenant_id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invoice).toBeDefined();
      expect(response.body.invoice.invoice_number).toBe('INV-2026-02-0001');
    });

    it('should return 400 if tenant_id is missing', async () => {
      const response = await request(app)
        .get('/api/v1/invoices/123e4567-e89b-12d3-a456-426614174002');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required parameter: tenant_id');
    });

    it('should return 404 if invoice not found', async () => {
      paymentService.getInvoice.mockRejectedValue(new Error('Invoice not found'));

      const response = await request(app)
        .get('/api/v1/invoices/123e4567-e89b-12d3-a456-426614174002')
        .query({ tenant_id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Invoice not found');
    });
  });

  describe('GET /api/v1/invoices/number/:invoice_number', () => {
    it('should retrieve invoice by invoice number', async () => {
      const mockInvoice = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        invoice_number: 'INV-2026-02-0001',
        status: 'issued',
      };

      paymentService.getInvoiceByNumber.mockResolvedValue(mockInvoice);

      const response = await request(app)
        .get('/api/v1/invoices/number/INV-2026-02-0001')
        .query({ tenant_id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invoice.invoice_number).toBe('INV-2026-02-0001');
    });
  });

  describe('GET /api/v1/invoices', () => {
    it('should list invoices', async () => {
      const mockInvoices = [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          invoice_number: 'INV-2026-02-0001',
          status: 'issued',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174003',
          invoice_number: 'INV-2026-02-0002',
          status: 'paid',
        },
      ];

      paymentService.listInvoices.mockResolvedValue(mockInvoices);

      const response = await request(app)
        .get('/api/v1/invoices')
        .query({ tenant_id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invoices).toBeDefined();
      expect(response.body.invoices.length).toBe(2);
      expect(response.body.count).toBe(2);
    });

    it('should filter invoices by student_id', async () => {
      const mockInvoices = [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          invoice_number: 'INV-2026-02-0001',
          student_id: '123e4567-e89b-12d3-a456-426614174001',
        },
      ];

      paymentService.listInvoices.mockResolvedValue(mockInvoices);

      const response = await request(app)
        .get('/api/v1/invoices')
        .query({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          student_id: '123e4567-e89b-12d3-a456-426614174001',
        });

      expect(response.status).toBe(200);
      expect(response.body.invoices.length).toBe(1);
    });
  });

  describe('PATCH /api/v1/invoices/:id/status', () => {
    it('should update invoice status', async () => {
      const mockInvoice = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        invoice_number: 'INV-2026-02-0001',
        status: 'paid',
      };

      paymentService.updateInvoiceStatus.mockResolvedValue(mockInvoice);

      const response = await request(app)
        .patch('/api/v1/invoices/123e4567-e89b-12d3-a456-426614174002/status')
        .send({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          status: 'paid',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invoice.status).toBe('paid');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .patch('/api/v1/invoices/123e4567-e89b-12d3-a456-426614174002/status')
        .send({
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          // Missing status
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
    });
  });

  describe('GET /api/v1/invoices/:id/pdf', () => {
    it('should generate and download invoice PDF', async () => {
      const mockPDF = Buffer.from('<html>Invoice PDF</html>');
      const mockInvoice = {
        invoice_number: 'INV-2026-02-0001',
      };

      paymentService.generateInvoicePDF.mockResolvedValue(mockPDF);
      paymentService.getInvoice.mockResolvedValue(mockInvoice);

      const response = await request(app)
        .get('/api/v1/invoices/123e4567-e89b-12d3-a456-426614174002/pdf')
        .query({ tenant_id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('INV-2026-02-0001.pdf');
    });
  });

  describe('GET /api/v1/invoices/gaps/detect', () => {
    it('should detect gaps in invoice sequence', async () => {
      const mockGaps = [
        { year: 2026, month: 2, missing_sequence: 3 },
        { year: 2026, month: 2, missing_sequence: 5 },
      ];

      paymentService.detectInvoiceGaps.mockResolvedValue(mockGaps);

      const response = await request(app)
        .get('/api/v1/invoices/gaps/detect')
        .query({ tenant_id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.gaps).toBeDefined();
      expect(response.body.gaps.length).toBe(2);
      expect(response.body.has_gaps).toBe(true);
      expect(response.body.count).toBe(2);
    });

    it('should return empty array if no gaps', async () => {
      paymentService.detectInvoiceGaps.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/invoices/gaps/detect')
        .query({ tenant_id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(response.status).toBe(200);
      expect(response.body.has_gaps).toBe(false);
      expect(response.body.count).toBe(0);
    });
  });
});
