/**
 * Payment Service
 * 
 * Integrates with Stripe and Razorpay payment gateways
 * Supports Indian payment methods: credit card, debit card, UPI, net banking
 * Currency: Indian Rupee (₹ INR)
 */

const Stripe = require('stripe');
const Razorpay = require('razorpay');
const crypto = require('crypto');

class PaymentService {
  constructor() {
    // Initialize Stripe (if configured)
    this.stripe = null;
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
      });
    }

    // Initialize Razorpay (if configured)
    this.razorpay = null;
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      this.razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
    }

    this.currency = process.env.DEFAULT_CURRENCY || 'INR';
    this.testMode = process.env.NODE_ENV !== 'production';
  }

  /**
   * Get active payment gateway
   * Priority: Razorpay (for India) > Stripe
   */
  getActiveGateway() {
    if (this.razorpay) {
      return 'razorpay';
    }
    if (this.stripe) {
      return 'stripe';
    }
    throw new Error('No payment gateway configured');
  }

  /**
   * Create a payment intent/order
   * 
   * @param {Object} params - Payment parameters
   * @param {number} params.amount - Amount in smallest currency unit (paise for INR)
   * @param {string} params.currency - Currency code (default: INR)
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.studentId - Student ID
   * @param {string} params.description - Payment description
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Payment intent/order details
   */
  async createPayment({ amount, currency = this.currency, tenantId, studentId, description, metadata = {} }) {
    const gateway = this.getActiveGateway();

    // Add tenant and student info to metadata
    const enrichedMetadata = {
      ...metadata,
      tenant_id: tenantId,
      student_id: studentId,
      environment: this.testMode ? 'test' : 'production',
    };

    if (gateway === 'razorpay') {
      return this.createRazorpayOrder({ amount, currency, description, metadata: enrichedMetadata });
    } else {
      return this.createStripePaymentIntent({ amount, currency, description, metadata: enrichedMetadata });
    }
  }

  /**
   * Create Razorpay order
   */
  async createRazorpayOrder({ amount, currency, description, metadata }) {
    if (!this.razorpay) {
      throw new Error('Razorpay not configured');
    }

    const options = {
      amount: amount, // Amount in paise
      currency: currency,
      receipt: `rcpt_${Date.now()}`,
      notes: metadata,
    };

    const order = await this.razorpay.orders.create(options);

    return {
      gateway: 'razorpay',
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      receipt: order.receipt,
      created_at: order.created_at,
      metadata: order.notes,
    };
  }

  /**
   * Create Stripe payment intent
   */
  async createStripePaymentIntent({ amount, currency, description, metadata }) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amount, // Amount in smallest currency unit
      currency: currency.toLowerCase(),
      description: description,
      metadata: metadata,
      payment_method_types: ['card'], // Can be extended to support more methods
    });

    return {
      gateway: 'stripe',
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      status: paymentIntent.status,
      created: paymentIntent.created,
      metadata: paymentIntent.metadata,
    };
  }

  /**
   * Retrieve payment details
   * 
   * @param {string} paymentId - Payment ID
   * @param {string} gateway - Gateway name ('stripe' or 'razorpay')
   * @returns {Promise<Object>} Payment details
   */
  async getPayment(paymentId, gateway) {
    if (gateway === 'razorpay') {
      return this.getRazorpayPayment(paymentId);
    } else if (gateway === 'stripe') {
      return this.getStripePayment(paymentId);
    } else {
      throw new Error(`Unsupported gateway: ${gateway}`);
    }
  }

  /**
   * Get Razorpay payment details
   */
  async getRazorpayPayment(paymentId) {
    if (!this.razorpay) {
      throw new Error('Razorpay not configured');
    }

    const payment = await this.razorpay.payments.fetch(paymentId);

    return {
      gateway: 'razorpay',
      id: payment.id,
      order_id: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      email: payment.email,
      contact: payment.contact,
      created_at: payment.created_at,
      metadata: payment.notes,
    };
  }

  /**
   * Get Stripe payment details
   */
  async getStripePayment(paymentId) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);

    return {
      gateway: 'stripe',
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      status: paymentIntent.status,
      payment_method: paymentIntent.payment_method,
      created: paymentIntent.created,
      metadata: paymentIntent.metadata,
    };
  }

  /**
   * Verify webhook signature
   * 
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - Webhook signature header
   * @param {string} gateway - Gateway name
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(payload, signature, gateway) {
    if (gateway === 'razorpay') {
      return this.verifyRazorpaySignature(payload, signature);
    } else if (gateway === 'stripe') {
      return this.verifyStripeSignature(payload, signature);
    } else {
      throw new Error(`Unsupported gateway: ${gateway}`);
    }
  }

  /**
   * Verify Razorpay webhook signature
   */
  verifyRazorpaySignature(payload, signature) {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      throw new Error('Razorpay webhook secret not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Verify Stripe webhook signature
   */
  verifyStripeSignature(payload, signature) {
    if (!this.stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Stripe webhook secret not configured');
    }

    try {
      this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Parse webhook event
   * 
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - Webhook signature
   * @param {string} gateway - Gateway name
   * @returns {Object} Parsed webhook event
   */
  parseWebhookEvent(payload, signature, gateway) {
    if (gateway === 'razorpay') {
      return this.parseRazorpayWebhook(payload, signature);
    } else if (gateway === 'stripe') {
      return this.parseStripeWebhook(payload, signature);
    } else {
      throw new Error(`Unsupported gateway: ${gateway}`);
    }
  }

  /**
   * Parse Razorpay webhook
   */
  parseRazorpayWebhook(payload, signature) {
    // Verify signature first
    if (!this.verifyRazorpaySignature(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const event = JSON.parse(payload);

    return {
      gateway: 'razorpay',
      id: event.payload.payment.entity.id,
      event_type: event.event,
      payment_id: event.payload.payment.entity.id,
      order_id: event.payload.payment.entity.order_id,
      amount: event.payload.payment.entity.amount,
      currency: event.payload.payment.entity.currency,
      status: event.payload.payment.entity.status,
      method: event.payload.payment.entity.method,
      created_at: event.created_at,
      metadata: event.payload.payment.entity.notes,
    };
  }

  /**
   * Parse Stripe webhook
   */
  parseStripeWebhook(payload, signature) {
    if (!this.stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Stripe not configured');
    }

    const event = this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    const paymentIntent = event.data.object;

    return {
      gateway: 'stripe',
      id: event.id,
      event_type: event.type,
      payment_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      status: paymentIntent.status,
      payment_method: paymentIntent.payment_method,
      created: event.created,
      metadata: paymentIntent.metadata,
    };
  }

  /**
   * Get supported payment methods
   * 
   * @returns {Object} Supported payment methods by gateway
   */
  getSupportedPaymentMethods() {
    const methods = {
      razorpay: {
        available: !!this.razorpay,
        methods: [
          'card', // Credit/Debit cards
          'netbanking', // Net banking
          'upi', // UPI
          'wallet', // Wallets (Paytm, PhonePe, etc.)
          'emi', // EMI
        ],
        currency: 'INR',
      },
      stripe: {
        available: !!this.stripe,
        methods: [
          'card', // Credit/Debit cards
        ],
        currency: 'INR',
      },
    };

    return methods;
  }

  /**
   * Check if service is configured
   */
  isConfigured() {
    return !!(this.stripe || this.razorpay);
  }

  /**
   * Get test mode status
   */
  isTestMode() {
    return this.testMode;
  }

  /**
   * Generate invoice for a payment
   * 
   * @param {Object} params - Invoice parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.studentId - Student ID
   * @param {string} params.paymentId - Payment ID (optional)
   * @param {Array} params.lineItems - Array of line items
   * @param {Object} params.taxDetails - Tax details (CGST, SGST, IGST)
   * @param {Object} params.discountDetails - Discount details
   * @param {string} params.notes - Invoice notes
   * @param {Date} params.dueDate - Due date
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Generated invoice
   */
  async generateInvoice({ tenantId, studentId, paymentId, lineItems, taxDetails = {}, discountDetails = {}, notes, dueDate }, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    // Validate line items
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      throw new Error('Line items are required');
    }

    // Calculate subtotal
    const subtotal = lineItems.reduce((sum, item) => {
      if (!item.description || typeof item.unit_price !== 'number' || typeof item.quantity !== 'number') {
        throw new Error('Invalid line item format');
      }
      return sum + (item.unit_price * item.quantity);
    }, 0);

    // Calculate tax amount
    const taxRate = (taxDetails.cgst || 0) + (taxDetails.sgst || 0) + (taxDetails.igst || 0);
    const taxAmount = Math.round((subtotal * taxRate) / 100);

    // Calculate discount amount
    let discountAmount = 0;
    if (discountDetails.type === 'percentage') {
      discountAmount = Math.round((subtotal * (discountDetails.value || 0)) / 100);
    } else if (discountDetails.type === 'fixed') {
      discountAmount = discountDetails.value || 0;
    }

    // Calculate total
    const totalAmount = subtotal + taxAmount - discountAmount;

    if (totalAmount < 0) {
      throw new Error('Total amount cannot be negative');
    }

    // Generate invoice number using database function
    const invoiceNumberResult = await db.query(
      'SELECT * FROM generate_invoice_number($1)',
      [tenantId]
    );

    const { invoice_number, invoice_year, invoice_month, invoice_sequence } = invoiceNumberResult.rows[0];

    // Insert invoice
    const result = await db.query(`
      INSERT INTO invoices (
        tenant_id, student_id, payment_id,
        invoice_number, invoice_year, invoice_month, invoice_sequence,
        issue_date, due_date, status,
        subtotal, tax_amount, discount_amount, total_amount, currency,
        line_items, tax_details, discount_details, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `, [
      tenantId,
      studentId,
      paymentId || null,
      invoice_number,
      invoice_year,
      invoice_month,
      invoice_sequence,
      new Date(),
      dueDate || null,
      'issued',
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      this.currency,
      JSON.stringify(lineItems),
      JSON.stringify(taxDetails),
      JSON.stringify(discountDetails),
      notes || null
    ]);

    return this.formatInvoice(result.rows[0]);
  }

  /**
   * Get invoice by ID
   * 
   * @param {string} invoiceId - Invoice ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Invoice details
   */
  async getInvoice(invoiceId, tenantId, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    const result = await db.query(
      'SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2',
      [invoiceId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Invoice not found');
    }

    return this.formatInvoice(result.rows[0]);
  }

  /**
   * Get invoice by invoice number
   * 
   * @param {string} invoiceNumber - Invoice number
   * @param {string} tenantId - Tenant ID
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Invoice details
   */
  async getInvoiceByNumber(invoiceNumber, tenantId, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    const result = await db.query(
      'SELECT * FROM invoices WHERE invoice_number = $1 AND tenant_id = $2',
      [invoiceNumber, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Invoice not found');
    }

    return this.formatInvoice(result.rows[0]);
  }

  /**
   * List invoices for a student
   * 
   * @param {string} studentId - Student ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} db - Database client
   * @param {Object} options - Query options (limit, offset, status)
   * @returns {Promise<Array>} List of invoices
   */
  async listInvoices(studentId, tenantId, db, options = {}) {
    if (!db) {
      throw new Error('Database client is required');
    }

    const { limit = 50, offset = 0, status } = options;

    let query = 'SELECT * FROM invoices WHERE tenant_id = $1';
    const params = [tenantId];

    if (studentId) {
      query += ' AND student_id = $2';
      params.push(studentId);
    }

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await db.query(query, params);

    return result.rows.map(row => this.formatInvoice(row));
  }

  /**
   * Update invoice status
   * 
   * @param {string} invoiceId - Invoice ID
   * @param {string} status - New status
   * @param {string} tenantId - Tenant ID
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Updated invoice
   */
  async updateInvoiceStatus(invoiceId, status, tenantId, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    const validStatuses = ['draft', 'issued', 'paid', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const result = await db.query(
      'UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [status, invoiceId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Invoice not found');
    }

    return this.formatInvoice(result.rows[0]);
  }

  /**
   * Detect gaps in invoice sequence
   * 
   * @param {string} tenantId - Tenant ID
   * @param {Object} db - Database client
   * @param {number} year - Year (optional, defaults to current year)
   * @param {number} month - Month (optional, defaults to current month)
   * @returns {Promise<Array>} List of missing sequence numbers
   */
  async detectInvoiceGaps(tenantId, db, year = null, month = null) {
    if (!db) {
      throw new Error('Database client is required');
    }

    const result = await db.query(
      'SELECT * FROM detect_invoice_gaps($1, $2, $3)',
      [tenantId, year, month]
    );

    return result.rows;
  }

  /**
   * Format invoice for API response
   * 
   * @param {Object} row - Database row
   * @returns {Object} Formatted invoice
   */
  formatInvoice(row) {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      student_id: row.student_id,
      payment_id: row.payment_id,
      invoice_number: row.invoice_number,
      invoice_year: row.invoice_year,
      invoice_month: row.invoice_month,
      invoice_sequence: row.invoice_sequence,
      issue_date: row.issue_date,
      due_date: row.due_date,
      status: row.status,
      subtotal: row.subtotal,
      tax_amount: row.tax_amount,
      discount_amount: row.discount_amount,
      total_amount: row.total_amount,
      currency: row.currency,
      line_items: row.line_items,
      tax_details: row.tax_details,
      discount_details: row.discount_details,
      notes: row.notes,
      pdf_url: row.pdf_url,
      pdf_generated_at: row.pdf_generated_at,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Generate invoice PDF
   * 
   * @param {string} invoiceId - Invoice ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} db - Database client
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generateInvoicePDF(invoiceId, tenantId, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    const invoice = await this.getInvoice(invoiceId, tenantId, db);

    // Get tenant details
    const tenantResult = await db.query(
      'SELECT * FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      throw new Error('Tenant not found');
    }

    const tenant = tenantResult.rows[0];

    // Get student details
    const studentResult = await db.query(
      'SELECT * FROM students WHERE id = $1 AND tenant_id = $2',
      [invoice.student_id, tenantId]
    );

    if (studentResult.rows.length === 0) {
      throw new Error('Student not found');
    }

    const student = studentResult.rows[0];

    // Generate PDF using a simple HTML template
    const html = this.generateInvoiceHTML(invoice, tenant, student);

    // For now, return the HTML as a buffer
    // In production, you would use a library like puppeteer or pdfkit
    return Buffer.from(html, 'utf8');
  }

  /**
   * Create refund request
   * 
   * @param {Object} params - Refund request parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.paymentId - Payment ID (optional)
   * @param {string} params.invoiceId - Invoice ID (optional)
   * @param {number} params.refundAmount - Refund amount in smallest currency unit
   * @param {string} params.refundType - 'full' or 'partial'
   * @param {string} params.reason - Refund reason
   * @param {Array} params.supportingDocuments - Array of document URLs
   * @param {string} params.requestedBy - User ID who requested the refund
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Created refund request
   */
  async createRefundRequest({ tenantId, paymentId, invoiceId, refundAmount, refundType, reason, supportingDocuments = [], requestedBy }, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    // Validate that at least one of paymentId or invoiceId is provided
    if (!paymentId && !invoiceId) {
      throw new Error('Either payment_id or invoice_id must be provided');
    }

    // Validate refund type
    if (!['full', 'partial'].includes(refundType)) {
      throw new Error('Refund type must be either "full" or "partial"');
    }

    // Insert refund request
    const result = await db.query(`
      INSERT INTO refund_requests (
        tenant_id, payment_id, invoice_id,
        refund_amount, currency, refund_type, reason,
        supporting_documents, requested_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      tenantId,
      paymentId || null,
      invoiceId || null,
      refundAmount,
      this.currency,
      refundType,
      reason,
      JSON.stringify(supportingDocuments),
      requestedBy,
      'pending'
    ]);

    return this.formatRefundRequest(result.rows[0]);
  }

  /**
   * Get refund request by ID
   * 
   * @param {string} refundRequestId - Refund request ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Refund request details
   */
  async getRefundRequest(refundRequestId, tenantId, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    const result = await db.query(
      'SELECT * FROM refund_requests WHERE id = $1 AND tenant_id = $2',
      [refundRequestId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Refund request not found');
    }

    return this.formatRefundRequest(result.rows[0]);
  }

  /**
   * List refund requests
   * 
   * @param {string} tenantId - Tenant ID
   * @param {Object} db - Database client
   * @param {Object} options - Query options (limit, offset, status, paymentId, invoiceId)
   * @returns {Promise<Array>} List of refund requests
   */
  async listRefundRequests(tenantId, db, options = {}) {
    if (!db) {
      throw new Error('Database client is required');
    }

    const { limit = 50, offset = 0, status, paymentId, invoiceId } = options;

    let query = 'SELECT * FROM refund_requests WHERE tenant_id = $1';
    const params = [tenantId];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (paymentId) {
      query += ` AND payment_id = $${params.length + 1}`;
      params.push(paymentId);
    }

    if (invoiceId) {
      query += ` AND invoice_id = $${params.length + 1}`;
      params.push(invoiceId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return result.rows.map(row => this.formatRefundRequest(row));
  }

  /**
   * Approve refund request (approval chain step)
   * 
   * @param {string} refundRequestId - Refund request ID
   * @param {string} tenantId - Tenant ID
   * @param {string} approverRole - 'teacher', 'admin', or 'finance_manager'
   * @param {string} approverId - User ID of approver
   * @param {string} comments - Optional comments
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Updated refund request
   */
  async approveRefundRequest(refundRequestId, tenantId, approverRole, approverId, comments, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    // Validate approver role
    if (!['teacher', 'admin', 'finance_manager'].includes(approverRole)) {
      throw new Error('Invalid approver role');
    }

    let client;
    const useTransaction = !!db.connect;

    try {
      // Get client
      if (useTransaction) {
        client = await db.connect();
        await client.query('BEGIN');
      } else {
        client = db;
      }

      // Get current refund request
      const refundResult = await client.query(
        'SELECT * FROM refund_requests WHERE id = $1 AND tenant_id = $2',
        [refundRequestId, tenantId]
      );

      if (refundResult.rows.length === 0) {
        throw new Error('Refund request not found');
      }

      const refund = refundResult.rows[0];

      // Check if already approved or rejected
      if (refund.status !== 'pending') {
        throw new Error(`Refund request is already ${refund.status}`);
      }

      // Update approval fields based on role
      let updateQuery;
      let updateParams;

      if (approverRole === 'teacher') {
        updateQuery = `
          UPDATE refund_requests 
          SET teacher_approved_by = $1, teacher_approved_at = NOW(), updated_at = NOW()
          WHERE id = $2 AND tenant_id = $3
          RETURNING *
        `;
        updateParams = [approverId, refundRequestId, tenantId];
      } else if (approverRole === 'admin') {
        // Check if teacher has approved
        if (!refund.teacher_approved_by) {
          throw new Error('Teacher approval required first');
        }
        updateQuery = `
          UPDATE refund_requests 
          SET admin_approved_by = $1, admin_approved_at = NOW(), updated_at = NOW()
          WHERE id = $2 AND tenant_id = $3
          RETURNING *
        `;
        updateParams = [approverId, refundRequestId, tenantId];
      } else if (approverRole === 'finance_manager') {
        // Check if teacher and admin have approved
        if (!refund.teacher_approved_by || !refund.admin_approved_by) {
          throw new Error('Teacher and Admin approval required first');
        }
        updateQuery = `
          UPDATE refund_requests 
          SET finance_approved_by = $1, finance_approved_at = NOW(), status = 'approved', updated_at = NOW()
          WHERE id = $2 AND tenant_id = $3
          RETURNING *
        `;
        updateParams = [approverId, refundRequestId, tenantId];
      }

      const updateResult = await client.query(updateQuery, updateParams);

      // Log approval in history
      await client.query(`
        INSERT INTO refund_approval_history (
          tenant_id, refund_request_id, approver_role, approver_id, action, comments
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [tenantId, refundRequestId, approverRole, approverId, 'approved', comments || null]);

      // Commit transaction if using pool
      if (useTransaction) {
        await client.query('COMMIT');
      }

      return this.formatRefundRequest(updateResult.rows[0]);
    } catch (error) {
      // Rollback transaction if using pool
      if (useTransaction && client) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (useTransaction && client) {
        client.release();
      }
    }
  }

  /**
   * Reject refund request
   * 
   * @param {string} refundRequestId - Refund request ID
   * @param {string} tenantId - Tenant ID
   * @param {string} approverRole - 'teacher', 'admin', or 'finance_manager'
   * @param {string} approverId - User ID of approver
   * @param {string} rejectionReason - Reason for rejection
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Updated refund request
   */
  async rejectRefundRequest(refundRequestId, tenantId, approverRole, approverId, rejectionReason, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    // Validate approver role
    if (!['teacher', 'admin', 'finance_manager'].includes(approverRole)) {
      throw new Error('Invalid approver role');
    }

    if (!rejectionReason) {
      throw new Error('Rejection reason is required');
    }

    let client;
    const useTransaction = !!db.connect;

    try {
      // Get client
      if (useTransaction) {
        client = await db.connect();
        await client.query('BEGIN');
      } else {
        client = db;
      }

      // Update refund request status to rejected
      let updateQuery;
      let updateParams;

      if (approverRole === 'teacher') {
        updateQuery = `
          UPDATE refund_requests 
          SET teacher_approved_by = $1, teacher_rejection_reason = $2, status = 'rejected', updated_at = NOW()
          WHERE id = $3 AND tenant_id = $4
          RETURNING *
        `;
        updateParams = [approverId, rejectionReason, refundRequestId, tenantId];
      } else if (approverRole === 'admin') {
        updateQuery = `
          UPDATE refund_requests 
          SET admin_approved_by = $1, admin_rejection_reason = $2, status = 'rejected', updated_at = NOW()
          WHERE id = $3 AND tenant_id = $4
          RETURNING *
        `;
        updateParams = [approverId, rejectionReason, refundRequestId, tenantId];
      } else if (approverRole === 'finance_manager') {
        updateQuery = `
          UPDATE refund_requests 
          SET finance_approved_by = $1, finance_rejection_reason = $2, status = 'rejected', updated_at = NOW()
          WHERE id = $3 AND tenant_id = $4
          RETURNING *
        `;
        updateParams = [approverId, rejectionReason, refundRequestId, tenantId];
      }

      const updateResult = await client.query(updateQuery, updateParams);

      if (updateResult.rows.length === 0) {
        throw new Error('Refund request not found');
      }

      // Log rejection in history
      await client.query(`
        INSERT INTO refund_approval_history (
          tenant_id, refund_request_id, approver_role, approver_id, action, comments
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [tenantId, refundRequestId, approverRole, approverId, 'rejected', rejectionReason]);

      // Commit transaction if using pool
      if (useTransaction) {
        await client.query('COMMIT');
      }

      return this.formatRefundRequest(updateResult.rows[0]);
    } catch (error) {
      // Rollback transaction if using pool
      if (useTransaction && client) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (useTransaction && client) {
        client.release();
      }
    }
  }

  /**
   * Process approved refund (execute refund with payment gateway)
   * 
   * @param {string} refundRequestId - Refund request ID
   * @param {string} tenantId - Tenant ID
   * @param {string} processedBy - User ID who processed the refund
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Updated refund request with gateway details
   */
  async processRefund(refundRequestId, tenantId, processedBy, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    let client;
    const useTransaction = !!db.connect;

    try {
      // Get client
      if (useTransaction) {
        client = await db.connect();
        await client.query('BEGIN');
      } else {
        client = db;
      }

      // Get refund request
      const refundResult = await client.query(
        'SELECT * FROM refund_requests WHERE id = $1 AND tenant_id = $2',
        [refundRequestId, tenantId]
      );

      if (refundResult.rows.length === 0) {
        throw new Error('Refund request not found');
      }

      const refund = refundResult.rows[0];

      // Check if approved
      if (refund.status !== 'approved') {
        throw new Error('Refund request must be approved before processing');
      }

      // Get payment details
      let payment = null;
      if (refund.payment_id) {
        const paymentResult = await client.query(
          'SELECT * FROM payments WHERE id = $1 AND tenant_id = $2',
          [refund.payment_id, tenantId]
        );
        if (paymentResult.rows.length > 0) {
          payment = paymentResult.rows[0];
        }
      }

      // Process refund with gateway
      let gatewayRefund = null;
      if (payment) {
        try {
          if (payment.gateway === 'razorpay') {
            gatewayRefund = await this.processRazorpayRefund(payment.payment_id, refund.refund_amount);
          } else if (payment.gateway === 'stripe') {
            gatewayRefund = await this.processStripeRefund(payment.payment_id, refund.refund_amount);
          }
        } catch (error) {
          console.error('Gateway refund error:', error);
          // Continue even if gateway fails - manual processing may be needed
        }
      }

      // Update refund request
      const updateResult = await client.query(`
        UPDATE refund_requests 
        SET 
          status = 'processed',
          processed_by = $1,
          processed_at = NOW(),
          gateway_refund_id = $2,
          gateway_status = $3,
          updated_at = NOW()
        WHERE id = $4 AND tenant_id = $5
        RETURNING *
      `, [
        processedBy,
        gatewayRefund?.id || null,
        gatewayRefund?.status || 'manual_processing_required',
        refundRequestId,
        tenantId
      ]);

      // Create credit note if invoice exists
      if (refund.invoice_id) {
        await this.createCreditNote(refund.invoice_id, refundRequestId, refund.refund_amount, refund.reason, tenantId, client);
      }

      // Update invoice status if full refund
      if (refund.invoice_id && refund.refund_type === 'full') {
        await client.query(
          'UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
          ['refunded', refund.invoice_id, tenantId]
        );
      }

      // Commit transaction if using pool
      if (useTransaction) {
        await client.query('COMMIT');
      }

      return this.formatRefundRequest(updateResult.rows[0]);
    } catch (error) {
      // Rollback transaction if using pool
      if (useTransaction && client) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (useTransaction && client) {
        client.release();
      }
    }
  }

  /**
   * Process Razorpay refund
   */
  async processRazorpayRefund(paymentId, amount) {
    if (!this.razorpay) {
      throw new Error('Razorpay not configured');
    }

    const refund = await this.razorpay.payments.refund(paymentId, {
      amount: amount,
    });

    return {
      id: refund.id,
      payment_id: refund.payment_id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      created_at: refund.created_at,
    };
  }

  /**
   * Process Stripe refund
   */
  async processStripeRefund(paymentIntentId, amount) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount,
    });

    return {
      id: refund.id,
      payment_intent: refund.payment_intent,
      amount: refund.amount,
      currency: refund.currency.toUpperCase(),
      status: refund.status,
      created: refund.created,
    };
  }

  /**
   * Create credit note for refund
   */
  async createCreditNote(invoiceId, refundRequestId, creditAmount, reason, tenantId, db) {
    // Generate credit note number
    const creditNoteNumberResult = await db.query(
      'SELECT * FROM generate_credit_note_number($1)',
      [tenantId]
    );

    const { credit_note_number, credit_note_year, credit_note_month, credit_note_sequence } = creditNoteNumberResult.rows[0];

    // Insert credit note
    const result = await db.query(`
      INSERT INTO credit_notes (
        tenant_id, invoice_id, refund_request_id,
        credit_note_number, credit_note_year, credit_note_month, credit_note_sequence,
        issue_date, credit_amount, currency, reason, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      tenantId,
      invoiceId,
      refundRequestId,
      credit_note_number,
      credit_note_year,
      credit_note_month,
      credit_note_sequence,
      new Date(),
      creditAmount,
      this.currency,
      reason,
      'issued'
    ]);

    return this.formatCreditNote(result.rows[0]);
  }

  /**
   * Get refund approval history
   * 
   * @param {string} refundRequestId - Refund request ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} db - Database client
   * @returns {Promise<Array>} Approval history
   */
  async getRefundApprovalHistory(refundRequestId, tenantId, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    const result = await db.query(
      'SELECT * FROM refund_approval_history WHERE refund_request_id = $1 AND tenant_id = $2 ORDER BY created_at ASC',
      [refundRequestId, tenantId]
    );

    return result.rows.map(row => ({
      id: row.id,
      refund_request_id: row.refund_request_id,
      approver_role: row.approver_role,
      approver_id: row.approver_id,
      action: row.action,
      comments: row.comments,
      created_at: row.created_at,
    }));
  }

  /**
   * Format refund request for API response
   */
  formatRefundRequest(row) {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      payment_id: row.payment_id,
      invoice_id: row.invoice_id,
      refund_amount: row.refund_amount,
      currency: row.currency,
      refund_type: row.refund_type,
      reason: row.reason,
      supporting_documents: row.supporting_documents,
      status: row.status,
      requested_by: row.requested_by,
      teacher_approved_by: row.teacher_approved_by,
      teacher_approved_at: row.teacher_approved_at,
      teacher_rejection_reason: row.teacher_rejection_reason,
      admin_approved_by: row.admin_approved_by,
      admin_approved_at: row.admin_approved_at,
      admin_rejection_reason: row.admin_rejection_reason,
      finance_approved_by: row.finance_approved_by,
      finance_approved_at: row.finance_approved_at,
      finance_rejection_reason: row.finance_rejection_reason,
      processed_by: row.processed_by,
      processed_at: row.processed_at,
      gateway_refund_id: row.gateway_refund_id,
      gateway_status: row.gateway_status,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Format credit note for API response
   */
  formatCreditNote(row) {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      invoice_id: row.invoice_id,
      refund_request_id: row.refund_request_id,
      credit_note_number: row.credit_note_number,
      credit_note_year: row.credit_note_year,
      credit_note_month: row.credit_note_month,
      credit_note_sequence: row.credit_note_sequence,
      issue_date: row.issue_date,
      credit_amount: row.credit_amount,
      currency: row.currency,
      reason: row.reason,
      status: row.status,
      pdf_url: row.pdf_url,
      pdf_generated_at: row.pdf_generated_at,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Upload and parse bank statement for reconciliation
   * 
   * @param {Object} params - Upload parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.bankAccountId - Bank account ID
   * @param {Date} params.statementDate - Statement date
   * @param {string} params.fileName - File name
   * @param {string} params.fileUrl - File URL (optional)
   * @param {Array} params.transactions - Parsed transactions
   * @param {string} params.uploadedBy - User ID who uploaded
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Reconciliation session
   */
  async uploadBankStatement({ tenantId, bankAccountId, statementDate, fileName, fileUrl, transactions, uploadedBy }, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      throw new Error('Transactions array is required');
    }

    let client;
    const useTransaction = !!db.connect;

    try {
      // Get client
      if (useTransaction) {
        client = await db.connect();
        await client.query('BEGIN');
      } else {
        client = db;
      }

      // Create reconciliation session
      const sessionResult = await client.query(`
        INSERT INTO bank_reconciliation_sessions (
          tenant_id, bank_account_id, statement_date,
          statement_file_name, statement_file_url,
          total_bank_transactions, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        tenantId,
        bankAccountId,
        statementDate,
        fileName,
        fileUrl || null,
        transactions.length,
        'in_progress'
      ]);

      const session = sessionResult.rows[0];

      // Insert bank transactions
      for (const txn of transactions) {
        await client.query(`
          INSERT INTO bank_transactions (
            tenant_id, reconciliation_session_id, bank_account_id,
            transaction_date, transaction_reference, description,
            debit_amount, credit_amount, balance, currency, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          tenantId,
          session.id,
          bankAccountId,
          txn.date,
          txn.reference || null,
          txn.description || null,
          txn.debit || 0,
          txn.credit || 0,
          txn.balance || null,
          txn.currency || 'INR',
          JSON.stringify(txn.metadata || {})
        ]);
      }

      // Commit transaction if using pool
      if (useTransaction) {
        await client.query('COMMIT');
      }

      return this.formatReconciliationSession(session);
    } catch (error) {
      // Rollback transaction if using pool
      if (useTransaction && client) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (useTransaction && client) {
        client.release();
      }
    }
  }

  /**
   * Perform automatic reconciliation matching
   * 
   * @param {string} sessionId - Reconciliation session ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Reconciliation results
   */
  async performReconciliation(sessionId, tenantId, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    let client;
    const useTransaction = !!db.connect;

    try {
      // Get client
      if (useTransaction) {
        client = await db.connect();
        await client.query('BEGIN');
      } else {
        client = db;
      }

      // Get session
      const sessionResult = await client.query(
        'SELECT * FROM bank_reconciliation_sessions WHERE id = $1 AND tenant_id = $2',
        [sessionId, tenantId]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Reconciliation session not found');
      }

      const session = sessionResult.rows[0];

      // Get bank transactions for this session
      const bankTxnsResult = await client.query(
        'SELECT * FROM bank_transactions WHERE reconciliation_session_id = $1 AND tenant_id = $2 ORDER BY transaction_date',
        [sessionId, tenantId]
      );

      const bankTransactions = bankTxnsResult.rows;

      // Get system payments for the statement date range
      const paymentsResult = await client.query(`
        SELECT * FROM payments 
        WHERE tenant_id = $1 
        AND created_at::date = $2
        AND status = 'succeeded'
        ORDER BY created_at
      `, [tenantId, session.statement_date]);

      const systemPayments = paymentsResult.rows;

      const results = {
        matched: [],
        unmatched_bank: [],
        unmatched_system: [],
        discrepancies: []
      };

      // Track which payments have been matched
      const matchedPaymentIds = new Set();

      // Match bank transactions with system payments
      for (const bankTxn of bankTransactions) {
        let bestMatch = null;
        let bestMatchScore = 0;

        // Try to find matching payment
        for (const payment of systemPayments) {
          if (matchedPaymentIds.has(payment.id)) {
            continue; // Already matched
          }

          let score = 0;

          // Match by transaction reference
          if (bankTxn.transaction_reference && payment.gateway_transaction_id) {
            if (bankTxn.transaction_reference === payment.gateway_transaction_id) {
              score += 50;
            } else if (bankTxn.transaction_reference.includes(payment.gateway_transaction_id) ||
                       payment.gateway_transaction_id.includes(bankTxn.transaction_reference)) {
              score += 30;
            }
          }

          // Match by amount (credit amount should match payment amount)
          const bankAmount = parseFloat(bankTxn.credit_amount) * 100; // Convert to paise
          const paymentAmount = parseFloat(payment.amount);
          const amountDiff = Math.abs(bankAmount - paymentAmount);

          if (amountDiff < 1) {
            score += 40; // Exact match
          } else if (amountDiff < 100) {
            score += 20; // Close match (within ₹1)
          }

          // Match by date
          const bankDate = new Date(bankTxn.transaction_date);
          const paymentDate = new Date(payment.created_at);
          const daysDiff = Math.abs((bankDate - paymentDate) / (1000 * 60 * 60 * 24));

          if (daysDiff === 0) {
            score += 10;
          } else if (daysDiff <= 2) {
            score += 5;
          }

          if (score > bestMatchScore) {
            bestMatchScore = score;
            bestMatch = payment;
          }
        }

        // Determine match type based on score
        if (bestMatch && bestMatchScore >= 70) {
          // Good match
          const bankAmount = parseFloat(bankTxn.credit_amount) * 100;
          const paymentAmount = parseFloat(bestMatch.amount);
          const amountDiff = bankAmount - paymentAmount;

          if (Math.abs(amountDiff) < 1) {
            // Perfect match
            await client.query(`
              INSERT INTO reconciliation_matches (
                tenant_id, reconciliation_session_id, bank_transaction_id, payment_id,
                match_type, match_confidence, amount_difference, resolution_status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
              tenantId, sessionId, bankTxn.id, bestMatch.id,
              'matched', bestMatchScore, 0, 'resolved'
            ]);

            // Mark payment as reconciled
            await client.query(
              'UPDATE payments SET reconciled = true, reconciled_at = NOW() WHERE id = $1',
              [bestMatch.id]
            );

            results.matched.push({
              bank_transaction: bankTxn,
              payment: bestMatch,
              confidence: bestMatchScore
            });

            matchedPaymentIds.add(bestMatch.id);
          } else {
            // Amount mismatch - discrepancy
            const matchResult = await client.query(`
              INSERT INTO reconciliation_matches (
                tenant_id, reconciliation_session_id, bank_transaction_id, payment_id,
                match_type, match_confidence, amount_difference, resolution_status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              RETURNING *
            `, [
              tenantId, sessionId, bankTxn.id, bestMatch.id,
              'discrepancy', bestMatchScore, amountDiff, 'pending'
            ]);

            const match = matchResult.rows[0];

            // Create discrepancy record
            await client.query(`
              INSERT INTO reconciliation_discrepancies (
                tenant_id, reconciliation_session_id, reconciliation_match_id,
                discrepancy_type, bank_amount, system_amount, difference, severity
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
              tenantId, sessionId, match.id,
              'amount_mismatch', bankAmount, paymentAmount, amountDiff,
              Math.abs(amountDiff) > 1000 ? 'high' : 'medium'
            ]);

            results.discrepancies.push({
              bank_transaction: bankTxn,
              payment: bestMatch,
              difference: amountDiff,
              confidence: bestMatchScore
            });

            matchedPaymentIds.add(bestMatch.id);
          }
        } else {
          // No good match found - unmatched bank transaction
          await client.query(`
            INSERT INTO reconciliation_matches (
              tenant_id, reconciliation_session_id, bank_transaction_id,
              match_type, resolution_status
            ) VALUES ($1, $2, $3, $4, $5)
          `, [
            tenantId, sessionId, bankTxn.id,
            'unmatched_bank', 'pending'
          ]);

          results.unmatched_bank.push(bankTxn);
        }
      }

      // Find unmatched system payments
      for (const payment of systemPayments) {
        if (!matchedPaymentIds.has(payment.id)) {
          await client.query(`
            INSERT INTO reconciliation_matches (
              tenant_id, reconciliation_session_id, payment_id,
              match_type, resolution_status
            ) VALUES ($1, $2, $3, $4, $5)
          `, [
            tenantId, sessionId, payment.id,
            'unmatched_system', 'pending'
          ]);

          results.unmatched_system.push(payment);
        }
      }

      // Update session statistics
      await client.query('SELECT update_reconciliation_session_stats($1)', [sessionId]);

      // Commit transaction if using pool
      if (useTransaction) {
        await client.query('COMMIT');
      }

      return results;
    } catch (error) {
      // Rollback transaction if using pool
      if (useTransaction && client) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (useTransaction && client) {
        client.release();
      }
    }
  }

  /**
   * Get reconciliation session details
   * 
   * @param {string} sessionId - Reconciliation session ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Session details with matches
   */
  async getReconciliationSession(sessionId, tenantId, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    // Get session
    const sessionResult = await db.query(
      'SELECT * FROM bank_reconciliation_sessions WHERE id = $1 AND tenant_id = $2',
      [sessionId, tenantId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Reconciliation session not found');
    }

    const session = this.formatReconciliationSession(sessionResult.rows[0]);

    // Get matches with details
    const matchesResult = await db.query(`
      SELECT 
        rm.*,
        bt.transaction_date, bt.transaction_reference, bt.description as bank_description,
        bt.credit_amount, bt.debit_amount,
        p.amount as payment_amount, p.gateway_transaction_id, p.status as payment_status
      FROM reconciliation_matches rm
      LEFT JOIN bank_transactions bt ON rm.bank_transaction_id = bt.id
      LEFT JOIN payments p ON rm.payment_id = p.id
      WHERE rm.reconciliation_session_id = $1 AND rm.tenant_id = $2
      ORDER BY rm.created_at
    `, [sessionId, tenantId]);

    session.matches = matchesResult.rows.map(row => ({
      id: row.id,
      match_type: row.match_type,
      match_confidence: row.match_confidence,
      amount_difference: row.amount_difference,
      resolution_status: row.resolution_status,
      resolution_notes: row.resolution_notes,
      bank_transaction: row.bank_transaction_id ? {
        id: row.bank_transaction_id,
        date: row.transaction_date,
        reference: row.transaction_reference,
        description: row.bank_description,
        credit_amount: row.credit_amount,
        debit_amount: row.debit_amount
      } : null,
      payment: row.payment_id ? {
        id: row.payment_id,
        amount: row.payment_amount,
        gateway_transaction_id: row.gateway_transaction_id,
        status: row.payment_status
      } : null,
      created_at: row.created_at
    }));

    // Get discrepancies
    const discrepanciesResult = await db.query(
      'SELECT * FROM reconciliation_discrepancies WHERE reconciliation_session_id = $1 AND tenant_id = $2',
      [sessionId, tenantId]
    );

    session.discrepancies = discrepanciesResult.rows;

    return session;
  }

  /**
   * Manually match a bank transaction with a payment
   * 
   * @param {Object} params - Match parameters
   * @param {string} params.sessionId - Reconciliation session ID
   * @param {string} params.bankTransactionId - Bank transaction ID
   * @param {string} params.paymentId - Payment ID
   * @param {string} params.notes - Resolution notes
   * @param {string} params.resolvedBy - User ID who resolved
   * @param {string} params.tenantId - Tenant ID
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Updated match
   */
  async manuallyMatchTransaction({ sessionId, bankTransactionId, paymentId, notes, resolvedBy, tenantId }, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    let client;
    const useTransaction = !!db.connect;

    try {
      // Get client
      if (useTransaction) {
        client = await db.connect();
        await client.query('BEGIN');
      } else {
        client = db;
      }

      // Check if bank transaction already has a match
      const existingMatchResult = await client.query(
        'SELECT * FROM reconciliation_matches WHERE bank_transaction_id = $1 AND tenant_id = $2',
        [bankTransactionId, tenantId]
      );

      if (existingMatchResult.rows.length > 0) {
        const existingMatch = existingMatchResult.rows[0];
        
        // Update existing match
        const updateResult = await client.query(`
          UPDATE reconciliation_matches
          SET 
            payment_id = $1,
            match_type = 'manual_match',
            match_confidence = 100,
            resolution_status = 'resolved',
            resolution_notes = $2,
            resolved_by = $3,
            resolved_at = NOW(),
            updated_at = NOW()
          WHERE id = $4 AND tenant_id = $5
          RETURNING *
        `, [paymentId, notes, resolvedBy, existingMatch.id, tenantId]);

        // Mark payment as reconciled
        await client.query(
          'UPDATE payments SET reconciled = true, reconciled_at = NOW() WHERE id = $1',
          [paymentId]
        );

        // Update session statistics
        await client.query('SELECT update_reconciliation_session_stats($1)', [sessionId]);

        // Commit transaction if using pool
        if (useTransaction) {
          await client.query('COMMIT');
        }

        return this.formatReconciliationMatch(updateResult.rows[0]);
      } else {
        // Create new match
        const insertResult = await client.query(`
          INSERT INTO reconciliation_matches (
            tenant_id, reconciliation_session_id, bank_transaction_id, payment_id,
            match_type, match_confidence, resolution_status, resolution_notes, resolved_by, resolved_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          RETURNING *
        `, [
          tenantId, sessionId, bankTransactionId, paymentId,
          'manual_match', 100, 'resolved', notes, resolvedBy
        ]);

        // Mark payment as reconciled
        await client.query(
          'UPDATE payments SET reconciled = true, reconciled_at = NOW() WHERE id = $1',
          [paymentId]
        );

        // Update session statistics
        await client.query('SELECT update_reconciliation_session_stats($1)', [sessionId]);

        // Commit transaction if using pool
        if (useTransaction) {
          await client.query('COMMIT');
        }

        return this.formatReconciliationMatch(insertResult.rows[0]);
      }
    } catch (error) {
      // Rollback transaction if using pool
      if (useTransaction && client) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (useTransaction && client) {
        client.release();
      }
    }
  }

  /**
   * Complete reconciliation session
   * 
   * @param {string} sessionId - Reconciliation session ID
   * @param {string} tenantId - Tenant ID
   * @param {string} reconciledBy - User ID who completed reconciliation
   * @param {Object} db - Database client
   * @returns {Promise<Object>} Updated session
   */
  async completeReconciliation(sessionId, tenantId, reconciledBy, db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    const result = await db.query(`
      UPDATE bank_reconciliation_sessions
      SET 
        status = 'completed',
        reconciled_by = $1,
        reconciled_at = NOW(),
        updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `, [reconciledBy, sessionId, tenantId]);

    if (result.rows.length === 0) {
      throw new Error('Reconciliation session not found');
    }

    return this.formatReconciliationSession(result.rows[0]);
  }

  /**
   * List reconciliation sessions
   * 
   * @param {string} tenantId - Tenant ID
   * @param {Object} db - Database client
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of sessions
   */
  async listReconciliationSessions(tenantId, db, options = {}) {
    if (!db) {
      throw new Error('Database client is required');
    }

    const { limit = 50, offset = 0, status, bankAccountId } = options;

    let query = 'SELECT * FROM bank_reconciliation_sessions WHERE tenant_id = $1';
    const params = [tenantId];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (bankAccountId) {
      query += ` AND bank_account_id = $${params.length + 1}`;
      params.push(bankAccountId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return result.rows.map(row => this.formatReconciliationSession(row));
  }

  /**
   * Parse CSV bank statement
   * 
   * @param {string} csvContent - CSV file content
   * @returns {Array} Parsed transactions
   */
  parseBankStatementCSV(csvContent) {
    const lines = csvContent.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('Invalid CSV format: no data rows');
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Find column indices
    const dateIdx = header.findIndex(h => h.includes('date'));
    const refIdx = header.findIndex(h => h.includes('ref') || h.includes('transaction'));
    const descIdx = header.findIndex(h => h.includes('desc') || h.includes('narration'));
    const debitIdx = header.findIndex(h => h.includes('debit') || h.includes('withdrawal'));
    const creditIdx = header.findIndex(h => h.includes('credit') || h.includes('deposit'));
    const balanceIdx = header.findIndex(h => h.includes('balance'));

    if (dateIdx === -1) {
      throw new Error('CSV must contain a date column');
    }

    const transactions = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());

      const transaction = {
        date: values[dateIdx] || null,
        reference: refIdx !== -1 ? values[refIdx] : null,
        description: descIdx !== -1 ? values[descIdx] : null,
        debit: debitIdx !== -1 ? parseFloat(values[debitIdx] || 0) : 0,
        credit: creditIdx !== -1 ? parseFloat(values[creditIdx] || 0) : 0,
        balance: balanceIdx !== -1 ? parseFloat(values[balanceIdx] || 0) : null,
        currency: 'INR'
      };

      transactions.push(transaction);
    }

    return transactions;
  }

  /**
   * Format reconciliation session for API response
   */
  formatReconciliationSession(row) {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      bank_account_id: row.bank_account_id,
      statement_date: row.statement_date,
      statement_file_name: row.statement_file_name,
      statement_file_url: row.statement_file_url,
      status: row.status,
      total_bank_transactions: row.total_bank_transactions,
      matched_count: row.matched_count,
      unmatched_bank_count: row.unmatched_bank_count,
      unmatched_system_count: row.unmatched_system_count,
      discrepancy_count: row.discrepancy_count,
      reconciled_by: row.reconciled_by,
      reconciled_at: row.reconciled_at,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Format reconciliation match for API response
   */
  formatReconciliationMatch(row) {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      reconciliation_session_id: row.reconciliation_session_id,
      bank_transaction_id: row.bank_transaction_id,
      payment_id: row.payment_id,
      match_type: row.match_type,
      match_confidence: row.match_confidence,
      amount_difference: row.amount_difference,
      resolution_status: row.resolution_status,
      resolution_notes: row.resolution_notes,
      resolved_by: row.resolved_by,
      resolved_at: row.resolved_at,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Generate invoice HTML template
   * 
   * @param {Object} invoice - Invoice data
   * @param {Object} tenant - Tenant data
   * @param {Object} student - Student data
   * @returns {string} HTML template
   */
  generateInvoiceHTML(invoice, tenant, student) {
    const formatCurrency = (amount) => {
      return `₹${(amount / 100).toFixed(2)}`;
    };

    const formatDate = (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const lineItemsHTML = invoice.line_items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.description}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(item.unit_price)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(item.unit_price * item.quantity)}</td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #ddd;
      padding: 30px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
    }
    .invoice-details {
      text-align: right;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-weight: bold;
      margin-bottom: 10px;
      color: #2563eb;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background-color: #f3f4f6;
      padding: 10px;
      text-align: left;
      border-bottom: 2px solid #ddd;
    }
    .totals {
      margin-left: auto;
      width: 300px;
    }
    .totals tr td {
      padding: 8px;
    }
    .totals tr:last-child {
      font-weight: bold;
      font-size: 18px;
      border-top: 2px solid #333;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    .status {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 4px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .status-issued { background-color: #dbeafe; color: #1e40af; }
    .status-paid { background-color: #d1fae5; color: #065f46; }
    .status-cancelled { background-color: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div>
        <div class="logo">${tenant.name}</div>
        <div>${tenant.subdomain}.eduos.com</div>
      </div>
      <div class="invoice-details">
        <h1 style="margin: 0;">INVOICE</h1>
        <div style="margin-top: 10px;">
          <strong>${invoice.invoice_number}</strong>
        </div>
        <div style="margin-top: 5px;">
          <span class="status status-${invoice.status}">${invoice.status}</span>
        </div>
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
      <div class="section">
        <div class="section-title">Bill To:</div>
        <div><strong>${student.first_name} ${student.last_name}</strong></div>
        <div>Student ID: ${student.id}</div>
      </div>
      <div class="section" style="text-align: right;">
        <div><strong>Issue Date:</strong> ${formatDate(invoice.issue_date)}</div>
        ${invoice.due_date ? `<div><strong>Due Date:</strong> ${formatDate(invoice.due_date)}</div>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: center;">Quantity</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHTML}
      </tbody>
    </table>

    <table class="totals">
      <tr>
        <td>Subtotal:</td>
        <td style="text-align: right;">${formatCurrency(invoice.subtotal)}</td>
      </tr>
      ${invoice.tax_amount > 0 ? `
      <tr>
        <td>Tax (${invoice.tax_details.cgst ? `CGST ${invoice.tax_details.cgst}% + SGST ${invoice.tax_details.sgst}%` : `IGST ${invoice.tax_details.igst}%`}):</td>
        <td style="text-align: right;">${formatCurrency(invoice.tax_amount)}</td>
      </tr>
      ` : ''}
      ${invoice.discount_amount > 0 ? `
      <tr>
        <td>Discount ${invoice.discount_details.type === 'percentage' ? `(${invoice.discount_details.value}%)` : ''}:</td>
        <td style="text-align: right;">-${formatCurrency(invoice.discount_amount)}</td>
      </tr>
      ` : ''}
      <tr>
        <td>Total Amount:</td>
        <td style="text-align: right;">${formatCurrency(invoice.total_amount)}</td>
      </tr>
    </table>

    ${invoice.notes ? `
    <div class="section">
      <div class="section-title">Notes:</div>
      <div>${invoice.notes}</div>
    </div>
    ` : ''}

    <div class="footer">
      <p>Thank you for your payment!</p>
      <p>This is a computer-generated invoice and does not require a signature.</p>
      <p>Generated on ${formatDate(new Date())}</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}

// Export singleton instance
module.exports = new PaymentService();
