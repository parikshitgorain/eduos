-- ============================================================================
-- Migration 016: Payment Gateway Integration
-- ============================================================================
-- Description: Creates tables for payment processing and webhook handling
-- Author: EduOS Team
-- Date: 2026-02-07
-- Dependencies: 001_setup_rls_foundation.sql
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================
-- Stores payment transactions from Stripe and Razorpay
-- Supports Indian payment methods: credit card, debit card, UPI, net banking
-- Currency: Indian Rupee (₹ INR)

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  
  -- Payment Gateway Information
  gateway VARCHAR(20) NOT NULL CHECK (gateway IN ('stripe', 'razorpay')),
  payment_id VARCHAR(255) NOT NULL, -- Gateway payment ID
  order_id VARCHAR(255), -- Razorpay order ID (optional for Stripe)
  
  -- Payment Details
  amount INTEGER NOT NULL CHECK (amount > 0), -- Amount in smallest currency unit (paise for INR)
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'cancelled')),
  payment_method VARCHAR(50), -- card, upi, netbanking, wallet, etc.
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one payment record per gateway payment ID per tenant
  UNIQUE (tenant_id, payment_id)
);

-- Create indexes for performance
CREATE INDEX idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_gateway ON payments(gateway);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_payments_payment_id ON payments(payment_id);

-- Enable Row-Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access payments from their tenant
CREATE POLICY payments_tenant_isolation ON payments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON payments TO eduos_app;

-- ============================================================================
-- WEBHOOK_LOGS TABLE
-- ============================================================================
-- Stores webhook events from payment gateways
-- Implements idempotency using webhook_id + tenant_id
-- Retention: 90 days

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Idempotency
  idempotency_key VARCHAR(500) NOT NULL, -- webhook_id + tenant_id
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Webhook Information
  gateway VARCHAR(20) NOT NULL CHECK (gateway IN ('stripe', 'razorpay')),
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255) NOT NULL, -- Gateway event ID
  payment_id VARCHAR(255), -- Associated payment ID
  
  -- Payload
  payload JSONB NOT NULL,
  
  -- Processing Status
  status VARCHAR(50) NOT NULL CHECK (status IN ('received', 'processed', 'failed')),
  error_message TEXT,
  
  -- Retry Logic
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Unique constraint: prevent duplicate webhook processing
  UNIQUE (idempotency_key, tenant_id)
);

-- Create indexes for performance
CREATE INDEX idx_webhook_logs_tenant_id ON webhook_logs(tenant_id);
CREATE INDEX idx_webhook_logs_idempotency_key ON webhook_logs(idempotency_key);
CREATE INDEX idx_webhook_logs_gateway ON webhook_logs(gateway);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at);
CREATE INDEX idx_webhook_logs_payment_id ON webhook_logs(payment_id);
CREATE INDEX idx_webhook_logs_retry ON webhook_logs(status, retry_count, next_retry_at) WHERE status = 'failed';

-- Enable Row-Level Security
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access webhook logs from their tenant
CREATE POLICY webhook_logs_tenant_isolation ON webhook_logs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON webhook_logs TO eduos_app;

-- ============================================================================
-- AUTOMATIC WEBHOOK LOG CLEANUP
-- ============================================================================
-- Delete webhook logs older than 90 days

CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM webhook_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
-- Automatically update updated_at timestamp on payments table

CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_updated_at_trigger
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE payments IS 'Payment transactions from Stripe and Razorpay';
COMMENT ON COLUMN payments.amount IS 'Amount in smallest currency unit (paise for INR)';
COMMENT ON COLUMN payments.currency IS 'Currency code (default: INR)';
COMMENT ON COLUMN payments.payment_method IS 'Payment method: card, upi, netbanking, wallet, etc.';

COMMENT ON TABLE webhook_logs IS 'Webhook events from payment gateways with idempotency and retry logic';
COMMENT ON COLUMN webhook_logs.idempotency_key IS 'webhook_id + tenant_id for deduplication';
COMMENT ON COLUMN webhook_logs.payload IS 'Full webhook payload for audit trail';
COMMENT ON COLUMN webhook_logs.retry_count IS 'Number of retry attempts (max 7)';
COMMENT ON COLUMN webhook_logs.next_retry_at IS 'Scheduled time for next retry attempt';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    RAISE EXCEPTION 'Migration failed: payments table not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_logs') THEN
    RAISE EXCEPTION 'Migration failed: webhook_logs table not created';
  END IF;

  -- Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'payments' AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Migration failed: RLS not enabled on payments table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'webhook_logs' AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Migration failed: RLS not enabled on webhook_logs table';
  END IF;

  RAISE NOTICE 'Migration 016 completed successfully';
  RAISE NOTICE '✓ payments table created with RLS';
  RAISE NOTICE '✓ webhook_logs table created with RLS';
  RAISE NOTICE '✓ Indexes created for performance';
  RAISE NOTICE '✓ Idempotency constraints in place';
END $$;
