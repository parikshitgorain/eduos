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
}

// Export singleton instance
module.exports = new PaymentService();
