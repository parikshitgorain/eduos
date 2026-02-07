/**
 * Payment Service - Invoice Tests
 * 
 * Tests for invoice generation with sequential numbering
 */

const paymentService = require('./paymentService');
const { Pool } = require('pg');

// Mock database client
const mockDb = {
  query: jest.fn(),
};

describe('PaymentService - Invoice Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateInvoice', () => {
    it('should generate invoice with sequential number', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const studentId = '123e4567-e89b-12d3-a456-426614174001';
      const lineItems = [
        { description: 'Tuition Fee', quantity: 1, unit_price: 50000 },
        { description: 'Lab Fee', quantity: 1, unit_price: 10000 },
      ];

      // Mock invoice number generation
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          invoice_number: 'INV-2026-02-0001',
          invoice_year: 2026,
          invoice_month: 2,
          invoice_sequence: 1,
        }],
      });

      // Mock invoice insertion
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: '123e4567-e89b-12d3-a456-426614174002',
          tenant_id: tenantId,
          student_id: studentId,
          payment_id: null,
          invoice_number: 'INV-2026-02-0001',
          invoice_year: 2026,
          invoice_month: 2,
          invoice_sequence: 1,
          issue_date: new Date('2026-02-07'),
          due_date: null,
          status: 'issued',
          subtotal: 60000,
          tax_amount: 10800,
          discount_amount: 0,
          total_amount: 70800,
          currency: 'INR',
          line_items: lineItems,
          tax_details: { cgst: 9, sgst: 9 },
          discount_details: {},
          notes: null,
          pdf_url: null,
          pdf_generated_at: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const invoice = await paymentService.generateInvoice({
        tenantId,
        studentId,
        lineItems,
        taxDetails: { cgst: 9, sgst: 9 },
      }, mockDb);

      expect(invoice).toBeDefined();
      expect(invoice.invoice_number).toBe('INV-2026-02-0001');
      expect(invoice.subtotal).toBe(60000);
      expect(invoice.tax_amount).toBe(10800); // 18% of 60000
      expect(invoice.total_amount).toBe(70800);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should calculate tax correctly', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const studentId = '123e4567-e89b-12d3-a456-426614174001';
      const lineItems = [
        { description: 'Tuition Fee', quantity: 1, unit_price: 100000 },
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          invoice_number: 'INV-2026-02-0002',
          invoice_year: 2026,
          invoice_month: 2,
          invoice_sequence: 2,
        }],
      });

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: '123e4567-e89b-12d3-a456-426614174003',
          tenant_id: tenantId,
          student_id: studentId,
          payment_id: null,
          invoice_number: 'INV-2026-02-0002',
          invoice_year: 2026,
          invoice_month: 2,
          invoice_sequence: 2,
          issue_date: new Date('2026-02-07'),
          due_date: null,
          status: 'issued',
          subtotal: 100000,
          tax_amount: 18000,
          discount_amount: 0,
          total_amount: 118000,
          currency: 'INR',
          line_items: lineItems,
          tax_details: { cgst: 9, sgst: 9 },
          discount_details: {},
          notes: null,
          pdf_url: null,
          pdf_generated_at: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const invoice = await paymentService.generateInvoice({
        tenantId,
        studentId,
        lineItems,
        taxDetails: { cgst: 9, sgst: 9 },
      }, mockDb);

      expect(invoice.subtotal).toBe(100000);
      expect(invoice.tax_amount).toBe(18000); // 18% of 100000
      expect(invoice.total_amount).toBe(118000);
    });

    it('should calculate percentage discount correctly', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const studentId = '123e4567-e89b-12d3-a456-426614174001';
      const lineItems = [
        { description: 'Tuition Fee', quantity: 1, unit_price: 100000 },
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          invoice_number: 'INV-2026-02-0003',
          invoice_year: 2026,
          invoice_month: 2,
          invoice_sequence: 3,
        }],
      });

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: '123e4567-e89b-12d3-a456-426614174004',
          tenant_id: tenantId,
          student_id: studentId,
          payment_id: null,
          invoice_number: 'INV-2026-02-0003',
          invoice_year: 2026,
          invoice_month: 2,
          invoice_sequence: 3,
          issue_date: new Date('2026-02-07'),
          due_date: null,
          status: 'issued',
          subtotal: 100000,
          tax_amount: 18000,
          discount_amount: 10000,
          total_amount: 108000,
          currency: 'INR',
          line_items: lineItems,
          tax_details: { cgst: 9, sgst: 9 },
          discount_details: { type: 'percentage', value: 10 },
          notes: null,
          pdf_url: null,
          pdf_generated_at: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const invoice = await paymentService.generateInvoice({
        tenantId,
        studentId,
        lineItems,
        taxDetails: { cgst: 9, sgst: 9 },
        discountDetails: { type: 'percentage', value: 10 },
      }, mockDb);

      expect(invoice.subtotal).toBe(100000);
      expect(invoice.discount_amount).toBe(10000); // 10% of 100000
      expect(invoice.tax_amount).toBe(18000);
      expect(invoice.total_amount).toBe(108000); // 100000 + 18000 - 10000
    });

    it('should calculate fixed discount correctly', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const studentId = '123e4567-e89b-12d3-a456-426614174001';
      const lineItems = [
        { description: 'Tuition Fee', quantity: 1, unit_price: 100000 },
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          invoice_number: 'INV-2026-02-0004',
          invoice_year: 2026,
          invoice_month: 2,
          invoice_sequence: 4,
        }],
      });

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: '123e4567-e89b-12d3-a456-426614174005',
          tenant_id: tenantId,
          student_id: studentId,
          payment_id: null,
          invoice_number: 'INV-2026-02-0004',
          invoice_year: 2026,
          invoice_month: 2,
          invoice_sequence: 4,
          issue_date: new Date('2026-02-07'),
          due_date: null,
          status: 'issued',
          subtotal: 100000,
          tax_amount: 18000,
          discount_amount: 5000,
          total_amount: 113000,
          currency: 'INR',
          line_items: lineItems,
          tax_details: { cgst: 9, sgst: 9 },
          discount_details: { type: 'fixed', value: 5000 },
          notes: null,
          pdf_url: null,
          pdf_generated_at: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const invoice = await paymentService.generateInvoice({
        tenantId,
        studentId,
        lineItems,
        taxDetails: { cgst: 9, sgst: 9 },
        discountDetails: { type: 'fixed', value: 5000 },
      }, mockDb);

      expect(invoice.subtotal).toBe(100000);
      expect(invoice.discount_amount).toBe(5000);
      expect(invoice.tax_amount).toBe(18000);
      expect(invoice.total_amount).toBe(113000); // 100000 + 18000 - 5000
    });

    it('should throw error if line items are missing', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const studentId = '123e4567-e89b-12d3-a456-426614174001';

      await expect(
        paymentService.generateInvoice({
          tenantId,
          studentId,
          lineItems: [],
        }, mockDb)
      ).rejects.toThrow('Line items are required');
    });

    it('should throw error if line item format is invalid', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const studentId = '123e4567-e89b-12d3-a456-426614174001';
      const lineItems = [
        { description: 'Tuition Fee' }, // Missing quantity and unit_price
      ];

      await expect(
        paymentService.generateInvoice({
          tenantId,
          studentId,
          lineItems,
        }, mockDb)
      ).rejects.toThrow('Invalid line item format');
    });

    it('should throw error if database client is not provided', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const studentId = '123e4567-e89b-12d3-a456-426614174001';
      const lineItems = [
        { description: 'Tuition Fee', quantity: 1, unit_price: 50000 },
      ];

      await expect(
        paymentService.generateInvoice({
          tenantId,
          studentId,
          lineItems,
        }, null)
      ).rejects.toThrow('Database client is required');
    });

    it('should throw error if total amount is negative', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const studentId = '123e4567-e89b-12d3-a456-426614174001';
      const lineItems = [
        { description: 'Tuition Fee', quantity: 1, unit_price: 10000 },
      ];

      await expect(
        paymentService.generateInvoice({
          tenantId,
          studentId,
          lineItems,
          discountDetails: { type: 'fixed', value: 50000 }, // Discount > subtotal
        }, mockDb)
      ).rejects.toThrow('Total amount cannot be negative');
    });
  });

  describe('getInvoice', () => {
    it('should retrieve invoice by ID', async () => {
      const invoiceId = '123e4567-e89b-12d3-a456-426614174002';
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: invoiceId,
          tenant_id: tenantId,
          student_id: '123e4567-e89b-12d3-a456-426614174001',
          payment_id: null,
          invoice_number: 'INV-2026-02-0001',
          invoice_year: 2026,
          invoice_month: 2,
          invoice_sequence: 1,
          issue_date: new Date('2026-02-07'),
          due_date: null,
          status: 'issued',
          subtotal: 60000,
          tax_amount: 10800,
          discount_amount: 0,
          total_amount: 70800,
          currency: 'INR',
          line_items: [],
          tax_details: {},
          discount_details: {},
          notes: null,
          pdf_url: null,
          pdf_generated_at: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const invoice = await paymentService.getInvoice(invoiceId, tenantId, mockDb);

      expect(invoice).toBeDefined();
      expect(invoice.id).toBe(invoiceId);
      expect(invoice.invoice_number).toBe('INV-2026-02-0001');
    });

    it('should throw error if invoice not found', async () => {
      const invoiceId = '123e4567-e89b-12d3-a456-426614174002';
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';

      mockDb.query.mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        paymentService.getInvoice(invoiceId, tenantId, mockDb)
      ).rejects.toThrow('Invoice not found');
    });
  });

  describe('getInvoiceByNumber', () => {
    it('should retrieve invoice by invoice number', async () => {
      const invoiceNumber = 'INV-2026-02-0001';
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: '123e4567-e89b-12d3-a456-426614174002',
          tenant_id: tenantId,
          student_id: '123e4567-e89b-12d3-a456-426614174001',
          payment_id: null,
          invoice_number: invoiceNumber,
          invoice_year: 2026,
          invoice_month: 2,
          invoice_sequence: 1,
          issue_date: new Date('2026-02-07'),
          due_date: null,
          status: 'issued',
          subtotal: 60000,
          tax_amount: 10800,
          discount_amount: 0,
          total_amount: 70800,
          currency: 'INR',
          line_items: [],
          tax_details: {},
          discount_details: {},
          notes: null,
          pdf_url: null,
          pdf_generated_at: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const invoice = await paymentService.getInvoiceByNumber(invoiceNumber, tenantId, mockDb);

      expect(invoice).toBeDefined();
      expect(invoice.invoice_number).toBe(invoiceNumber);
    });
  });

  describe('listInvoices', () => {
    it('should list invoices for a student', async () => {
      const studentId = '123e4567-e89b-12d3-a456-426614174001';
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            tenant_id: tenantId,
            student_id: studentId,
            payment_id: null,
            invoice_number: 'INV-2026-02-0001',
            invoice_year: 2026,
            invoice_month: 2,
            invoice_sequence: 1,
            issue_date: new Date('2026-02-07'),
            due_date: null,
            status: 'issued',
            subtotal: 60000,
            tax_amount: 10800,
            discount_amount: 0,
            total_amount: 70800,
            currency: 'INR',
            line_items: [],
            tax_details: {},
            discount_details: {},
            notes: null,
            pdf_url: null,
            pdf_generated_at: null,
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const invoices = await paymentService.listInvoices(studentId, tenantId, mockDb);

      expect(invoices).toBeDefined();
      expect(invoices.length).toBe(1);
      expect(invoices[0].student_id).toBe(studentId);
    });
  });

  describe('updateInvoiceStatus', () => {
    it('should update invoice status', async () => {
      const invoiceId = '123e4567-e89b-12d3-a456-426614174002';
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: invoiceId,
          tenant_id: tenantId,
          student_id: '123e4567-e89b-12d3-a456-426614174001',
          payment_id: null,
          invoice_number: 'INV-2026-02-0001',
          invoice_year: 2026,
          invoice_month: 2,
          invoice_sequence: 1,
          issue_date: new Date('2026-02-07'),
          due_date: null,
          status: 'paid',
          subtotal: 60000,
          tax_amount: 10800,
          discount_amount: 0,
          total_amount: 70800,
          currency: 'INR',
          line_items: [],
          tax_details: {},
          discount_details: {},
          notes: null,
          pdf_url: null,
          pdf_generated_at: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const invoice = await paymentService.updateInvoiceStatus(invoiceId, 'paid', tenantId, mockDb);

      expect(invoice).toBeDefined();
      expect(invoice.status).toBe('paid');
    });

    it('should throw error for invalid status', async () => {
      const invoiceId = '123e4567-e89b-12d3-a456-426614174002';
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';

      await expect(
        paymentService.updateInvoiceStatus(invoiceId, 'invalid', tenantId, mockDb)
      ).rejects.toThrow('Invalid status');
    });
  });

  describe('detectInvoiceGaps', () => {
    it('should detect gaps in invoice sequence', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';

      mockDb.query.mockResolvedValueOnce({
        rows: [
          { year: 2026, month: 2, missing_sequence: 3 },
          { year: 2026, month: 2, missing_sequence: 5 },
        ],
      });

      const gaps = await paymentService.detectInvoiceGaps(tenantId, mockDb);

      expect(gaps).toBeDefined();
      expect(gaps.length).toBe(2);
      expect(gaps[0].missing_sequence).toBe(3);
      expect(gaps[1].missing_sequence).toBe(5);
    });

    it('should return empty array if no gaps', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';

      mockDb.query.mockResolvedValueOnce({
        rows: [],
      });

      const gaps = await paymentService.detectInvoiceGaps(tenantId, mockDb);

      expect(gaps).toBeDefined();
      expect(gaps.length).toBe(0);
    });
  });

  describe('generateInvoiceHTML', () => {
    it('should generate HTML template for invoice', () => {
      const invoice = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        invoice_number: 'INV-2026-02-0001',
        issue_date: new Date('2026-02-07'),
        due_date: new Date('2026-03-07'),
        status: 'issued',
        subtotal: 60000,
        tax_amount: 10800,
        discount_amount: 0,
        total_amount: 70800,
        currency: 'INR',
        line_items: [
          { description: 'Tuition Fee', quantity: 1, unit_price: 50000 },
          { description: 'Lab Fee', quantity: 1, unit_price: 10000 },
        ],
        tax_details: { cgst: 9, sgst: 9 },
        discount_details: {},
        notes: 'Thank you for your payment',
      };

      const tenant = {
        name: 'Test School',
        subdomain: 'test',
      };

      const student = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        first_name: 'John',
        last_name: 'Doe',
      };

      const html = paymentService.generateInvoiceHTML(invoice, tenant, student);

      expect(html).toContain('INV-2026-02-0001');
      expect(html).toContain('Test School');
      expect(html).toContain('John Doe');
      expect(html).toContain('Tuition Fee');
      expect(html).toContain('Lab Fee');
      expect(html).toContain('₹600.00'); // Subtotal
      expect(html).toContain('₹708.00'); // Total
    });
  });
});


  describe('generateInvoicePDF', () => {
    it('should generate PDF buffer for invoice', async () => {
      const invoiceId = '123e4567-e89b-12d3-a456-426614174002';
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';

      const mockInvoice = {
        id: invoiceId,
        tenant_id: tenantId,
        student_id: '123e4567-e89b-12d3-a456-426614174001',
        invoice_number: 'INV-2026-02-0001',
        invoice_date: new Date('2026-02-07'),
        due_date: new Date('2026-02-14'),
        amount: 100000,
        currency: 'INR',
        status: 'pending',
        line_items: [
          { description: 'Tuition Fee', quantity: 1, unit_price: 100000, amount: 100000 },
        ],
      };

      const mockTenant = {
        id: tenantId,
        name: 'Test School',
        address: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        postal_code: '12345',
        country: 'India',
      };

      const mockStudent = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        tenant_id: tenantId,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockInvoice] }) // getInvoice
        .mockResolvedValueOnce({ rows: [mockTenant] }) // get tenant
        .mockResolvedValueOnce({ rows: [mockStudent] }); // get student

      const pdfBuffer = await paymentService.generateInvoicePDF(invoiceId, tenantId, mockDb);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.toString()).toContain('INV-2026-02-0001');
      expect(pdfBuffer.toString()).toContain('Test School');
      expect(pdfBuffer.toString()).toContain('John Doe');
    });

    it('should throw error if tenant not found', async () => {
      const invoiceId = '123e4567-e89b-12d3-a456-426614174002';
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';

      const mockInvoice = {
        id: invoiceId,
        tenant_id: tenantId,
        student_id: '123e4567-e89b-12d3-a456-426614174001',
        invoice_number: 'INV-2026-02-0001',
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockInvoice] }) // getInvoice
        .mockResolvedValueOnce({ rows: [] }); // tenant not found

      await expect(
        paymentService.generateInvoicePDF(invoiceId, tenantId, mockDb)
      ).rejects.toThrow('Tenant not found');
    });

    it('should throw error if student not found', async () => {
      const invoiceId = '123e4567-e89b-12d3-a456-426614174002';
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';

      const mockInvoice = {
        id: invoiceId,
        tenant_id: tenantId,
        student_id: '123e4567-e89b-12d3-a456-426614174001',
        invoice_number: 'INV-2026-02-0001',
      };

      const mockTenant = {
        id: tenantId,
        name: 'Test School',
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockInvoice] }) // getInvoice
        .mockResolvedValueOnce({ rows: [mockTenant] }) // get tenant
        .mockResolvedValueOnce({ rows: [] }); // student not found

      await expect(
        paymentService.generateInvoicePDF(invoiceId, tenantId, mockDb)
      ).rejects.toThrow('Student not found');
    });
  });
