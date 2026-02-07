# Payment Gateway Integration

## Overview

EduOS Platform integrates with **Stripe** and **Razorpay** payment gateways to support Indian payment methods including credit cards, debit cards, UPI, and net banking. All transactions are processed in **Indian Rupee (₹ INR)**.

## Supported Payment Gateways

### Razorpay (Recommended for India)
- **Payment Methods**: Credit Card, Debit Card, UPI, Net Banking, Wallets (Paytm, PhonePe, etc.), EMI
- **Currency**: INR
- **Test Mode**: Sandbox environment available
- **Documentation**: https://razorpay.com/docs/

### Stripe
- **Payment Methods**: Credit Card, Debit Card
- **Currency**: INR
- **Test Mode**: Test mode available
- **Documentation**: https://stripe.com/docs

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Razorpay Configuration (India)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Currency
DEFAULT_CURRENCY=INR
```

### Gateway Priority

The system automatically selects the active gateway:
1. **Razorpay** (if configured) - Recommended for Indian market
2. **Stripe** (if configured) - Fallback option

## API Endpoints

### 1. Create Payment

**Endpoint**: `POST /api/v1/payments`

**Headers**:
- `Authorization`: Bearer token
- `Content-Type`: application/json

**Request Body**:
```json
{
  "amount": 10000,
  "currency": "INR",
  "student_id": "123e4567-e89b-12d3-a456-426614174000",
  "description": "Tuition fee payment for Semester 1",
  "metadata": {
    "invoice_id": "INV-2026-02-0001",
    "semester": "1",
    "academic_year": "2025-2026"
  }
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "gateway": "razorpay",
    "id": "order_MNqwertyuiop",
    "amount": 10000,
    "currency": "INR",
    "status": "created",
    "receipt": "rcpt_1707312000000",
    "created_at": 1707312000,
    "metadata": {
      "tenant_id": "tenant-123",
      "student_id": "123e4567-e89b-12d3-a456-426614174000",
      "invoice_id": "INV-2026-02-0001"
    }
  }
}
```

### 2. Get Payment Details

**Endpoint**: `GET /api/v1/payments/:gateway/:paymentId`

**Parameters**:
- `gateway`: `stripe` or `razorpay`
- `paymentId`: Payment ID from the gateway

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "gateway": "razorpay",
    "id": "pay_MNqwertyuiop",
    "order_id": "order_MNqwertyuiop",
    "amount": 10000,
    "currency": "INR",
    "status": "captured",
    "method": "upi",
    "email": "student@example.com",
    "contact": "+919876543210",
    "created_at": 1707312000,
    "metadata": {
      "tenant_id": "tenant-123",
      "student_id": "123e4567-e89b-12d3-a456-426614174000"
    }
  }
}
```

### 3. Get Supported Payment Methods

**Endpoint**: `GET /api/v1/payments/methods`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "razorpay": {
      "available": true,
      "methods": ["card", "netbanking", "upi", "wallet", "emi"],
      "currency": "INR"
    },
    "stripe": {
      "available": true,
      "methods": ["card"],
      "currency": "INR"
    }
  }
}
```

### 4. Health Check

**Endpoint**: `GET /api/v1/payments/health`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Payment service is healthy",
  "test_mode": true,
  "configured": true,
  "active_gateway": "razorpay"
}
```

## Webhook Integration

### Webhook Endpoint

**Endpoint**: `POST /api/v1/webhooks/payments`

This endpoint receives payment notifications from Stripe and Razorpay.

### Webhook Security

#### Razorpay Signature Verification
```
X-Razorpay-Signature: <HMAC-SHA256 signature>
```

#### Stripe Signature Verification
```
Stripe-Signature: <Stripe signature>
```

### Webhook Events

#### Razorpay Events
- `payment.captured` - Payment succeeded
- `payment.failed` - Payment failed
- `payment.authorized` - Payment pending

#### Stripe Events
- `payment_intent.succeeded` - Payment succeeded
- `payment_intent.payment_failed` - Payment failed
- `payment_intent.processing` - Payment pending

### Idempotency

Webhooks are deduplicated using `webhook_id + tenant_id` as the idempotency key. Duplicate webhooks return `200 OK` without processing.

### Webhook Payload Example (Razorpay)

```json
{
  "event": "payment.captured",
  "created_at": 1707312000,
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_MNqwertyuiop",
        "order_id": "order_MNqwertyuiop",
        "amount": 10000,
        "currency": "INR",
        "status": "captured",
        "method": "upi",
        "notes": {
          "tenant_id": "tenant-123",
          "student_id": "123e4567-e89b-12d3-a456-426614174000"
        }
      }
    }
  }
}
```

## Database Schema

### Payments Table

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL,
  gateway VARCHAR(20) NOT NULL,
  payment_id VARCHAR(255) NOT NULL,
  order_id VARCHAR(255),
  amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(50) NOT NULL,
  payment_method VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE (tenant_id, payment_id)
);
```

### Webhook Logs Table

```sql
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY,
  idempotency_key VARCHAR(500) NOT NULL,
  tenant_id UUID NOT NULL,
  gateway VARCHAR(20) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  payment_id VARCHAR(255),
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (idempotency_key, tenant_id)
);
```

## Testing

### Test Mode

Both Stripe and Razorpay provide test/sandbox environments:

#### Razorpay Test Cards
- **Success**: 4111 1111 1111 1111
- **Failure**: 4000 0000 0000 0002
- **CVV**: Any 3 digits
- **Expiry**: Any future date

#### Stripe Test Cards
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **CVV**: Any 3 digits
- **Expiry**: Any future date

### Running Tests

```bash
# Run payment service tests
npm test -- src/services/paymentService.test.js

# Run payment routes tests
npm test -- src/routes/payments.test.js

# Run webhook tests
npm test -- src/routes/webhooks.test.js
```

## Migration

### Run Migration

```bash
node database/run_migration_016.js
```

### Rollback Migration

```bash
# Execute rollback SQL
psql -U postgres -d eduos_db -f database/migrations/016_payment_gateway_rollback.sql
```

## Security Best Practices

1. **Never expose secret keys** in client-side code
2. **Always verify webhook signatures** before processing
3. **Use HTTPS** for all payment-related endpoints
4. **Store sensitive data encrypted** in the database
5. **Implement rate limiting** on payment endpoints
6. **Log all payment transactions** for audit trail
7. **Use idempotency keys** to prevent duplicate charges

## Error Handling

### Common Errors

#### Payment Creation Errors
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid authentication
- `500 Internal Server Error` - Payment gateway error

#### Webhook Errors
- `400 Bad Request` - Invalid signature or missing tenant_id
- `500 Internal Server Error` - Processing error (triggers retry)

### Retry Logic

Webhooks that fail with `500` status will be retried by the payment gateway with exponential backoff.

## Monitoring

### Key Metrics to Monitor

1. **Payment Success Rate**: `(successful_payments / total_payments) × 100`
2. **Webhook Processing Time**: Average time to process webhooks
3. **Failed Payments**: Count of failed payment attempts
4. **Duplicate Webhooks**: Count of duplicate webhook attempts
5. **Gateway Availability**: Uptime of payment gateways

### Alerts

Set up alerts for:
- Payment success rate drops below 95%
- Webhook processing time exceeds 5 seconds
- Failed payment count exceeds threshold
- Gateway downtime

## Compliance

### PCI DSS Compliance

EduOS Platform is PCI DSS compliant by design:
- **No card data storage**: Card details are handled by Stripe/Razorpay
- **Tokenization**: All payments use secure tokens
- **HTTPS only**: All payment endpoints require HTTPS
- **Audit logging**: All payment transactions are logged

### Data Retention

- **Payment records**: Retained for 7 years (Basic) to 99 years (Enterprise)
- **Webhook logs**: Retained for 90 days, then automatically deleted

## Support

### Razorpay Support
- Dashboard: https://dashboard.razorpay.com
- Support: support@razorpay.com
- Phone: +91-80-6890-6890

### Stripe Support
- Dashboard: https://dashboard.stripe.com
- Support: https://support.stripe.com
- Documentation: https://stripe.com/docs

## Troubleshooting

### Payment Creation Fails

1. Check gateway credentials in `.env`
2. Verify test mode is enabled for development
3. Check API logs for error messages
4. Verify tenant context is set correctly

### Webhook Not Received

1. Verify webhook URL is publicly accessible
2. Check webhook secret is configured correctly
3. Verify webhook signature verification is passing
4. Check webhook logs in database

### Duplicate Payments

1. Verify idempotency key is being used
2. Check webhook logs for duplicate entries
3. Ensure client-side doesn't retry on success

## Future Enhancements

- [ ] Support for recurring payments/subscriptions
- [ ] Payment refund workflow
- [ ] Invoice generation integration
- [ ] Bank reconciliation automation
- [ ] Multi-currency support
- [ ] Payment analytics dashboard
- [ ] Automated payment reminders
- [ ] Payment plan/installment support
