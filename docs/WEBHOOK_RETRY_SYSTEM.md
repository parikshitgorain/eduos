# Webhook Retry System

## Overview

The EduOS Platform implements a robust webhook retry system with exponential backoff to ensure reliable payment webhook processing from Stripe and Razorpay. This system guarantees that temporary failures (network issues, database unavailability) don't result in lost payment notifications.

## Features

### 1. Idempotent Webhook Processing

**Idempotency Key:** `webhook_id + tenant_id`

- Prevents duplicate webhook processing
- Returns `200 OK` for already-processed webhooks without reprocessing
- Allows retry of previously failed webhooks

### 2. Webhook Signature Verification (HMAC-SHA256)

**Razorpay:**
```javascript
HMAC-SHA256(webhook_secret, payload) === signature
```

**Stripe:**
```javascript
stripe.webhooks.constructEvent(payload, signature, webhook_secret)
```

### 3. Exponential Backoff Retry Schedule

| Attempt | Delay | Cumulative Time |
|---------|-------|-----------------|
| 1 | Immediate | 0 |
| 2 | 1 minute | 1 minute |
| 3 | 5 minutes | 6 minutes |
| 4 | 15 minutes | 21 minutes |
| 5 | 1 hour | 1 hour 21 minutes |
| 6 | 6 hours | 7 hours 21 minutes |
| 7 | 24 hours | 31 hours 21 minutes (final) |

**Maximum Retries:** 7 attempts over ~31 hours

### 4. Webhook Log Retention

- **Retention Period:** 90 days
- **Automatic Cleanup:** Scheduled job deletes logs older than 90 days
- **Audit Trail:** Full payload stored for compliance and debugging

## Architecture

### Components

1. **Webhook Endpoint** (`src/routes/webhooks.js`)
   - Receives webhooks from payment gateways
   - Verifies signatures
   - Checks idempotency
   - Logs webhook receipt
   - Processes webhook or marks as failed

2. **Webhook Retry Service** (`src/services/webhookRetryService.js`)
   - Manages retry logic
   - Implements exponential backoff
   - Processes failed webhooks
   - Tracks retry statistics

3. **Webhook Retry Job** (`src/jobs/webhookRetryJob.js`)
   - Scheduled job (runs every minute)
   - Processes webhooks ready for retry
   - Updates retry counts and next retry times

4. **Database Table** (`webhook_logs`)
   - Stores webhook events
   - Tracks processing status
   - Maintains retry metadata

## Database Schema

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
  status VARCHAR(50) NOT NULL, -- 'received', 'processed', 'failed'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (idempotency_key, tenant_id)
);
```

## Webhook Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Webhook Received                                             │
│    POST /api/v1/webhooks/payments                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Verify Signature (HMAC-SHA256)                               │
│    ✓ Valid → Continue                                           │
│    ✗ Invalid → Return 400 (no retry)                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Check Idempotency                                            │
│    Key: webhook_id + tenant_id                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌────────────────┐ ┌────────────┐ ┌────────────────┐
│ Already        │ │ Previously │ │ New Webhook    │
│ Processed      │ │ Failed     │ │                │
│ → Return 200   │ │ → Retry    │ │ → Process      │
└────────────────┘ └─────┬──────┘ └────────┬───────┘
                         │                 │
                         └────────┬────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Log Webhook Receipt                                          │
│    INSERT INTO webhook_logs (status = 'received')               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Process Webhook Event                                        │
│    - payment.succeeded → Update payment record                  │
│    - payment.failed → Update payment record                     │
│    - payment.pending → Update payment record                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌────────────────┐ ┌────────────┐ ┌────────────────┐
│ Success        │ │ Failure    │ │ Signature      │
│ → status =     │ │ → status = │ │ Error          │
│   'processed'  │ │   'failed' │ │ → Return 400   │
│ → Return 200   │ │ → Set      │ │   (no retry)   │
│                │ │   next_    │ │                │
│                │ │   retry_at │ │                │
│                │ │ → Return   │ │                │
│                │ │   500      │ │                │
└────────────────┘ └─────┬──────┘ └────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Retry Job (runs every minute)                                │
│    - Find failed webhooks where next_retry_at <= NOW()          │
│    - Retry processing with exponential backoff                  │
│    - Update retry_count and next_retry_at                       │
│    - Max 7 attempts over ~31 hours                              │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### 1. Webhook Receiver

**Endpoint:** `POST /api/v1/webhooks/payments`

**Headers:**
- Razorpay: `x-razorpay-signature`
- Stripe: `stripe-signature`

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "idempotency_key": "evt_123_tenant-456"
}
```

### 2. Retry Statistics

**Endpoint:** `GET /api/v1/webhooks/retry/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "pending_retries": 5,
    "max_retries_exceeded": 2,
    "successful_retries": 10,
    "avg_retries_to_success": 2.5,
    "max_retry_attempts": 7,
    "retry_schedule_seconds": [0, 60, 300, 900, 3600, 21600, 86400]
  }
}
```

### 3. Manual Retry Trigger

**Endpoint:** `POST /api/v1/webhooks/retry/process`

**Response:**
```json
{
  "success": true,
  "message": "Webhook retry processing completed",
  "data": {
    "total": 3,
    "successful": 2,
    "failed": 1
  }
}
```

## Deployment

### Scheduled Job Setup

#### Option 1: Cron (Linux/Unix)

```bash
# Add to crontab (runs every minute)
* * * * * cd /path/to/eduos && node src/jobs/webhookRetryJob.js >> /var/log/webhook-retry.log 2>&1
```

#### Option 2: Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: webhook-retry-job
spec:
  schedule: "* * * * *"  # Every minute
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: webhook-retry
            image: eduos-platform:latest
            command: ["node", "src/jobs/webhookRetryJob.js"]
          restartPolicy: OnFailure
```

#### Option 3: AWS EventBridge

```json
{
  "ScheduleExpression": "rate(1 minute)",
  "Target": {
    "Arn": "arn:aws:lambda:region:account:function:webhook-retry",
    "Input": "{}"
  }
}
```

### Environment Variables

```bash
# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Database
DATABASE_URL=postgresql://user:pass@host:5432/eduos
```

## Monitoring

### Key Metrics

1. **Webhook Processing Rate**
   - Total webhooks received per minute
   - Success rate (processed / total)
   - Failure rate (failed / total)

2. **Retry Statistics**
   - Pending retries
   - Max retries exceeded
   - Average retries to success

3. **Latency**
   - Webhook processing time (p50, p95, p99)
   - Retry job execution time

### Alerts

1. **High Failure Rate**
   - Trigger: Failure rate > 10% over 5 minutes
   - Action: Investigate payment gateway connectivity

2. **Max Retries Exceeded**
   - Trigger: > 5 webhooks exceed max retries in 1 hour
   - Action: Manual investigation required

3. **Retry Job Failure**
   - Trigger: Retry job fails 3 consecutive times
   - Action: Check database connectivity and job logs

## Testing

### Unit Tests

```bash
npm test src/services/webhookRetryService.test.js
npm test src/routes/webhooks.test.js
npm test src/jobs/webhookRetryJob.test.js
```

### Integration Tests

```bash
# Test webhook endpoint
curl -X POST http://localhost:3000/api/v1/webhooks/payments \
  -H "x-razorpay-signature: test_signature" \
  -H "Content-Type: application/json" \
  -d '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test"}}}}'

# Test retry statistics
curl http://localhost:3000/api/v1/webhooks/retry/stats

# Manually trigger retry processing
curl -X POST http://localhost:3000/api/v1/webhooks/retry/process
```

### Load Testing

```bash
# Simulate 100 concurrent webhooks
ab -n 1000 -c 100 -p webhook.json -T application/json \
  http://localhost:3000/api/v1/webhooks/payments
```

## Troubleshooting

### Issue: Webhooks Not Being Retried

**Symptoms:**
- Failed webhooks remain in `failed` status
- `next_retry_at` is in the past but webhook not retried

**Solutions:**
1. Check if retry job is running: `ps aux | grep webhookRetryJob`
2. Check retry job logs: `tail -f /var/log/webhook-retry.log`
3. Manually trigger retry: `POST /api/v1/webhooks/retry/process`

### Issue: Duplicate Webhook Processing

**Symptoms:**
- Same payment processed multiple times
- Duplicate payment records in database

**Solutions:**
1. Verify idempotency key uniqueness: `SELECT idempotency_key, COUNT(*) FROM webhook_logs GROUP BY idempotency_key HAVING COUNT(*) > 1`
2. Check for race conditions in webhook endpoint
3. Ensure database unique constraint is in place

### Issue: High Retry Failure Rate

**Symptoms:**
- Many webhooks reaching max retries
- `max_retries_exceeded` count increasing

**Solutions:**
1. Check database connectivity and performance
2. Review error messages in `webhook_logs.error_message`
3. Investigate payment gateway API changes
4. Check for data validation issues

## Best Practices

1. **Monitor Retry Statistics Daily**
   - Review pending retries and max retries exceeded
   - Investigate patterns in failed webhooks

2. **Set Up Alerts**
   - Configure alerts for high failure rates
   - Monitor retry job execution

3. **Regular Cleanup**
   - Ensure 90-day cleanup job is running
   - Archive old webhook logs if needed for compliance

4. **Test Webhook Handling**
   - Use payment gateway test mode
   - Simulate failures to verify retry logic
   - Test signature verification

5. **Document Gateway Changes**
   - Track payment gateway API updates
   - Update webhook event type mappings as needed

## Security Considerations

1. **Signature Verification**
   - Always verify webhook signatures
   - Use timing-safe comparison for HMAC
   - Rotate webhook secrets regularly

2. **Idempotency**
   - Never process duplicate webhooks
   - Use cryptographically secure idempotency keys

3. **Error Logging**
   - Log errors without exposing sensitive data
   - Sanitize payment details in logs

4. **Access Control**
   - Restrict access to retry endpoints
   - Require authentication for manual retry triggers

## Compliance

### Data Retention

- **Webhook Logs:** 90 days (configurable per tenant)
- **Payment Records:** 7 years (Basic), 99 years (Enterprise)

### Audit Trail

- All webhook events logged with full payload
- Retry attempts tracked with timestamps
- Error messages preserved for investigation

### GDPR/Privacy

- Webhook logs subject to data retention policies
- Personal data in webhooks handled per tenant privacy settings
- Right to erasure applies to webhook logs

## References

- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Razorpay Webhooks Documentation](https://razorpay.com/docs/webhooks/)
- [EduOS Payment Gateway Documentation](./PAYMENT_GATEWAY.md)
- [EduOS Payment Quick Start](./PAYMENT_QUICK_START.md)
