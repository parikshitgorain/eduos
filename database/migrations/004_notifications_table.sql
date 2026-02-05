-- Migration: 004_notifications_table.sql
-- Description: Add notifications table for email/SMS notifications
-- Version: 1.0
-- Date: 2026-02-05
-- Task: 1.2.2 - Implement domain verification workflow

-- ============================================================================
-- PART 1: CREATE NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Notification details
    type VARCHAR(50) NOT NULL, -- domain_verified, payment_received, etc.
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    
    -- Delivery information
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    channel VARCHAR(20) DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_reason TEXT,
    
    -- Retry tracking
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Tenant lookup index
CREATE INDEX idx_notifications_tenant_id ON notifications(tenant_id);

-- Status lookup index (for background jobs)
CREATE INDEX idx_notifications_status ON notifications(status) WHERE status IN ('pending', 'failed');

-- Type lookup index
CREATE INDEX idx_notifications_type ON notifications(type);

-- Retry scheduling index
CREATE INDEX idx_notifications_retry ON notifications(next_retry_at) WHERE status = 'failed' AND retry_count < max_retries;

-- Created at index for cleanup jobs
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ============================================================================
-- PART 3: CREATE TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 4: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO eduos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eduos_app;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('004', 'Add notifications table for email/SMS notifications')
ON CONFLICT (version) DO NOTHING;
