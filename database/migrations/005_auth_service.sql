-- ============================================================================
-- Migration 005: Authentication Service
-- ============================================================================
-- Description: Create tables for OAuth2/OIDC authentication service
-- Author: EduOS Team
-- Date: 2026-02-05
-- Task: 1.3.1 - Setup OAuth2/OIDC authentication service
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores user accounts with OAuth2/OIDC authentication
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  auth_provider VARCHAR(50), -- 'google', 'microsoft', 'local'
  auth_provider_id VARCHAR(255), -- Provider's user ID
  password_hash VARCHAR(255), -- For local authentication (future)
  roles TEXT[] DEFAULT ARRAY['user'], -- Array of role names
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'deleted'
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_tenant_unique UNIQUE (email, tenant_id)
);

-- Create indexes for users table
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_provider ON users(auth_provider);
CREATE INDEX idx_users_status ON users(status);

-- Enable Row-Level Security on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access users in their tenant
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================
-- Stores audit trail for all authentication and authorization events
-- ============================================================================

-- Check if audit_logs table exists and modify it if needed
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    -- Add new columns if they don't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'user_id') THEN
      ALTER TABLE audit_logs ADD COLUMN user_id UUID REFERENCES users(user_id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'action') THEN
      ALTER TABLE audit_logs ADD COLUMN action VARCHAR(100) NOT NULL DEFAULT 'unknown';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'resource_type') THEN
      ALTER TABLE audit_logs ADD COLUMN resource_type VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'resource_id') THEN
      ALTER TABLE audit_logs ADD COLUMN resource_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'details') THEN
      ALTER TABLE audit_logs ADD COLUMN details JSONB;
    END IF;
    
    RAISE NOTICE 'Updated existing audit_logs table';
  ELSE
    -- Create new audit_logs table
    CREATE TABLE audit_logs (
      log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(100),
      resource_id UUID,
      details JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    
    RAISE NOTICE 'Created new audit_logs table';
  END IF;
END $$;

-- Create indexes for audit_logs table (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_details ON audit_logs USING GIN (details);

-- Enable Row-Level Security on audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Audit logs can only be accessed by users in the same tenant
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- REFRESH TOKENS TABLE
-- ============================================================================
-- Stores refresh tokens for token rotation
-- ============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL, -- SHA-256 hash of refresh token
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash)
);

-- Create indexes for refresh_tokens table
CREATE INDEX idx_refresh_tokens_tenant_id ON refresh_tokens(tenant_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Enable Row-Level Security on refresh_tokens table
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Refresh tokens can only be accessed by users in the same tenant
CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- ROLES TABLE
-- ============================================================================
-- Stores role definitions with hierarchical structure
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  role_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(255),
  description TEXT,
  parent_role_id UUID REFERENCES roles(role_id) ON DELETE SET NULL,
  hierarchy_level INTEGER DEFAULT 0, -- 0 = SuperAdmin, 1 = InstituteAdmin, etc.
  permissions JSONB DEFAULT '[]', -- Array of permission strings
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT roles_name_tenant_unique UNIQUE (role_name, tenant_id)
);

-- Create indexes for roles table
CREATE INDEX idx_roles_tenant_id ON roles(tenant_id);
CREATE INDEX idx_roles_role_name ON roles(role_name);
CREATE INDEX idx_roles_parent_role_id ON roles(parent_role_id);
CREATE INDEX idx_roles_hierarchy_level ON roles(hierarchy_level);

-- Enable Row-Level Security on roles table
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Roles can only be accessed by users in the same tenant
CREATE POLICY tenant_isolation_roles ON roles
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================
-- Stores active user sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sessions_session_token_unique UNIQUE (session_token)
);

-- Create indexes for sessions table
CREATE INDEX idx_sessions_tenant_id ON sessions(tenant_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_session_token ON sessions(session_token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Enable Row-Level Security on sessions table
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Sessions can only be accessed by users in the same tenant
CREATE POLICY tenant_isolation_sessions ON sessions
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at on roles table
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert default roles (will be created for each tenant)
-- These are template roles that can be customized per tenant

-- Note: Actual role creation should be done during tenant provisioning
-- This is just a reference for the role hierarchy

COMMENT ON TABLE users IS 'User accounts with OAuth2/OIDC authentication';
COMMENT ON TABLE audit_logs IS 'Audit trail for authentication and authorization events';
COMMENT ON TABLE refresh_tokens IS 'Refresh tokens for token rotation';
COMMENT ON TABLE roles IS 'Role definitions with hierarchical structure';
COMMENT ON TABLE sessions IS 'Active user sessions';

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO eduos_app;
GRANT SELECT, INSERT ON audit_logs TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON roles TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO eduos_app;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 005: Authentication Service - COMPLETED';
  RAISE NOTICE 'Created tables: users, audit_logs, refresh_tokens, roles, sessions';
  RAISE NOTICE 'Enabled Row-Level Security on all tables';
  RAISE NOTICE 'Created indexes for performance optimization';
END $$;
