-- ============================================================================
-- Migration 007: Multi-Factor Authentication (MFA) Support
-- ============================================================================
-- Description: Add MFA support with TOTP and backup codes
-- Author: EduOS Team
-- Date: 2026-02-05
-- Task: 1.3.4 - Implement multi-factor authentication (MFA)
-- ============================================================================

-- ============================================================================
-- MFA_SETTINGS TABLE
-- ============================================================================
-- Stores MFA configuration for users
-- ============================================================================

CREATE TABLE IF NOT EXISTS mfa_settings (
  mfa_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255), -- Encrypted TOTP secret
  mfa_method VARCHAR(20) DEFAULT 'totp', -- 'totp', 'sms' (future)
  backup_codes_hash TEXT[], -- Array of hashed backup codes
  backup_codes_used INTEGER DEFAULT 0,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mfa_settings_user_unique UNIQUE (user_id, tenant_id)
);

-- Create indexes for mfa_settings table
CREATE INDEX idx_mfa_settings_tenant_id ON mfa_settings(tenant_id);
CREATE INDEX idx_mfa_settings_user_id ON mfa_settings(user_id);
CREATE INDEX idx_mfa_settings_enabled ON mfa_settings(mfa_enabled);

-- Enable Row-Level Security on mfa_settings table
ALTER TABLE mfa_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: MFA settings can only be accessed by users in the same tenant
CREATE POLICY tenant_isolation_mfa_settings ON mfa_settings
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- MFA_RECOVERY_ATTEMPTS TABLE
-- ============================================================================
-- Tracks MFA recovery attempts for security monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS mfa_recovery_attempts (
  attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  attempt_type VARCHAR(50) NOT NULL, -- 'backup_code', 'recovery_flow'
  success BOOLEAN DEFAULT FALSE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for mfa_recovery_attempts table
CREATE INDEX idx_mfa_recovery_attempts_tenant_id ON mfa_recovery_attempts(tenant_id);
CREATE INDEX idx_mfa_recovery_attempts_user_id ON mfa_recovery_attempts(user_id);
CREATE INDEX idx_mfa_recovery_attempts_created_at ON mfa_recovery_attempts(created_at DESC);

-- Enable Row-Level Security on mfa_recovery_attempts table
ALTER TABLE mfa_recovery_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Recovery attempts can only be accessed by users in the same tenant
CREATE POLICY tenant_isolation_mfa_recovery_attempts ON mfa_recovery_attempts
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- TENANT_MFA_POLICY TABLE
-- ============================================================================
-- Stores tenant-level MFA enforcement policies
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_mfa_policy (
  policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  mfa_required BOOLEAN DEFAULT FALSE, -- Enforce MFA for all users
  mfa_required_roles TEXT[], -- Roles that require MFA
  grace_period_days INTEGER DEFAULT 7, -- Days before MFA becomes mandatory
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_mfa_policy_tenant_unique UNIQUE (tenant_id)
);

-- Create indexes for tenant_mfa_policy table
CREATE INDEX idx_tenant_mfa_policy_tenant_id ON tenant_mfa_policy(tenant_id);

-- Enable Row-Level Security on tenant_mfa_policy table
ALTER TABLE tenant_mfa_policy ENABLE ROW LEVEL SECURITY;

-- RLS Policy: MFA policy can only be accessed by users in the same tenant
CREATE POLICY tenant_isolation_tenant_mfa_policy ON tenant_mfa_policy
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- ADD MFA COLUMNS TO USERS TABLE
-- ============================================================================

-- Add MFA-related columns to users table if they don't exist
DO $
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'mfa_enabled') THEN
    ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'mfa_enforced_at') THEN
    ALTER TABLE users ADD COLUMN mfa_enforced_at TIMESTAMPTZ;
  END IF;
END $;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Trigger to automatically update updated_at on mfa_settings table
CREATE TRIGGER update_mfa_settings_updated_at
  BEFORE UPDATE ON mfa_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at on tenant_mfa_policy table
CREATE TRIGGER update_tenant_mfa_policy_updated_at
  BEFORE UPDATE ON tenant_mfa_policy
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check if MFA is required for a user
CREATE OR REPLACE FUNCTION is_mfa_required(p_user_id UUID, p_tenant_id UUID)
RETURNS BOOLEAN AS $
DECLARE
  v_policy_required BOOLEAN;
  v_user_roles TEXT[];
  v_required_roles TEXT[];
  v_grace_period_days INTEGER;
  v_user_created_at TIMESTAMPTZ;
BEGIN
  -- Get tenant MFA policy
  SELECT mfa_required, mfa_required_roles, grace_period_days
  INTO v_policy_required, v_required_roles, v_grace_period_days
  FROM tenant_mfa_policy
  WHERE tenant_id = p_tenant_id;
  
  -- If no policy exists, MFA is not required
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- If MFA is required for all users
  IF v_policy_required THEN
    -- Check grace period
    SELECT created_at INTO v_user_created_at
    FROM users
    WHERE user_id = p_user_id;
    
    IF v_user_created_at + (v_grace_period_days || ' days')::INTERVAL < NOW() THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Check if user has any role that requires MFA
  SELECT roles INTO v_user_roles
  FROM users
  WHERE user_id = p_user_id;
  
  IF v_user_roles && v_required_roles THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE mfa_settings IS 'MFA configuration for users with TOTP secrets and backup codes';
COMMENT ON TABLE mfa_recovery_attempts IS 'Audit trail for MFA recovery attempts';
COMMENT ON TABLE tenant_mfa_policy IS 'Tenant-level MFA enforcement policies';
COMMENT ON FUNCTION is_mfa_required IS 'Check if MFA is required for a user based on tenant policy';

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_settings TO eduos_app;
GRANT SELECT, INSERT ON mfa_recovery_attempts TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_mfa_policy TO eduos_app;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $
BEGIN
  RAISE NOTICE 'Migration 007: MFA Support - COMPLETED';
  RAISE NOTICE 'Created tables: mfa_settings, mfa_recovery_attempts, tenant_mfa_policy';
  RAISE NOTICE 'Added MFA columns to users table';
  RAISE NOTICE 'Created function: is_mfa_required';
  RAISE NOTICE 'Enabled Row-Level Security on all tables';
END $;
