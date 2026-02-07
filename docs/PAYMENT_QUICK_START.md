# Payment Gateway - Quick Start Guide

## Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Add to `.env`:
```bash
# For Razorpay (Recommended for India)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_secret_key
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# OR for Stripe
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Currency
DEFAULT_CURRENCY=INR
```

### 3. Run Database Migration
```bash
node database/run_migration_016.js
```

## Usage Examples

### Create a Payment

```javascript
// POST /api/v1/payments
const response = await fetch('http://localhost:3000/api/v1/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    amount: 50000, // ₹500.00 (amount in paise)
    currency: 'INR',
    student_id: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Semester 1 Tuition Fee',
    metadata: {
      invoice_id: 'INV-2026-02-0001',
      semester: '1'
    }
  })
});

const payment = await response.json();
console.log(payment.data.id); // order_MNqwertyuiop
```

### Get Payment Status

```javascript
// GET /api/v1/payments/razorpay/pay_MNqwertyuiop
const response = await fetch(
  'http://localhost:3000/api/v1/payments/razorpay/pay_MNqwertyuiop',
  {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  }
);

const payment = await response.json();
console.log(payment.data.status); // 'captured', 'failed', etc.
```

### Check Supported Payment Methods

```javascript
// GET /api/v1/payments/methods
const response = await fetch('http://localhost:3000/api/v1/payments/methods');
const methods = await response.json();

console.log(methods.data.razorpay.methods);
// ['card', 'upi', 'netbanking', 'wallet', 'emi']
```

## Testing

### Test Cards

#### Razorpay
- **Success**: 4111 1111 1111 1111
- **Failure**: 4000 0000 0000 0002

#### Stripe
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002

### Run Tests
```bash
# All payment tests
npm test -- src/services/paymentService.test.js
npm test -- src/routes/payments.test.js
npm test -- src/routes/webhooks.test.js
```

## Webhook Setup

### 1. Configure Webhook URL

**Razorpay Dashboard**:
- Go to Settings → Webhooks
- Add webhook URL: `https://yourdomain.com/api/v1/webhooks/payments`
- Select events: `payment.captured`, `payment.failed`, `payment.authorized`
- Copy webhook secret to `.env`

**Stripe Dashboard**:
- Go to Developers → Webhooks
- Add endpoint: `https://yourdomain.com/api/v1/webhooks/payments`
- Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
- Copy signing secret to `.env`

### 2. Test Webhook Locally

Use ngrok for local testing:
```bash
ngrok http 3000
# Use the ngrok URL in gateway dashboard
```

## Common Issues

### Payment Creation Fails
```
Error: No payment gateway configured
```
**Solution**: Check `.env` has valid gateway credentials

### Webhook Signature Invalid
```
Error: Invalid webhook signature
```
**Solution**: Verify `RAZORPAY_WEBHOOK_SECRET` or `STRIPE_WEBHOOK_SECRET` matches dashboard

### Database Connection Error
```
Error: password authentication failed
```
**Solution**: Check database credentials in `.env`

## Amount Conversion

Always use **paise** (smallest currency unit):
- ₹1.00 = 100 paise
- ₹500.00 = 50000 paise
- ₹1,000.00 = 100000 paise

```javascript
// Convert rupees to paise
const rupees = 500;
const paise = rupees * 100; // 50000

// Convert paise to rupees
const paise = 50000;
const rupees = paise / 100; // 500
```

## API Response Codes

- `200 OK` - Success
- `201 Created` - Payment created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid token
- `500 Internal Server Error` - Gateway error

## Next Steps

1. ✅ Payment gateway integrated
2. 📝 Implement invoice generation (Task 4.1.3)
3. 📝 Add refund workflow (Task 4.1.4)
4. 📝 Build reconciliation UI (Task 4.1.5)

## Support

- **Documentation**: `docs/PAYMENT_GATEWAY.md`
- **Razorpay Docs**: https://razorpay.com/docs/
- **Stripe Docs**: https://stripe.com/docs
