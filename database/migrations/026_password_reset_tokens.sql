/**
 * Migration 026: Password Reset Tokens Table
 * 
 * Creates table for storing password reset tokens for email/password authentication
 * 
 * Dependencies:
 * - Migration 005 (users table)
 */

-- Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure token hasn't expired
  CONSTRAINT token_not_expired CHECK (expires_at > created_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Add comment
COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens for email/password authentication';
COMMENT ON COLUMN password_reset_tokens.token IS 'Unique reset token (hashed)';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration timestamp (typically 1 hour from creation)';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Timestamp when token was used (null if unused)';

-- Add columns to users table if they don't exist
DO $$ 
BEGIN
  -- Add password_hash column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'password_hash') THEN
    ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
    COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password for email/password authentication';
  END IF;
  
  -- Add mfa_enabled column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'mfa_enabled') THEN
    ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN users.mfa_enabled IS 'Whether MFA is enabled for this user';
  END IF;
  
  -- Add mfa_secret column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'mfa_secret') THEN
    ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(255);
    COMMENT ON COLUMN users.mfa_secret IS 'Encrypted TOTP secret for MFA';
  END IF;
  
  -- Add failed_login_attempts column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'failed_login_attempts') THEN
    ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
    COMMENT ON COLUMN users.failed_login_attempts IS 'Counter for failed login attempts (for CAPTCHA trigger)';
  END IF;
  
  -- Add last_failed_login_at column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'last_failed_login_at') THEN
    ALTER TABLE users ADD COLUMN last_failed_login_at TIMESTAMP;
    COMMENT ON COLUMN users.last_failed_login_at IS 'Timestamp of last failed login attempt';
  END IF;
  
  -- Add location column to tenants table if it doesn't exist (for search)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tenants' AND column_name = 'location') THEN
    ALTER TABLE tenants ADD COLUMN location VARCHAR(255);
    COMMENT ON COLUMN tenants.location IS 'Physical location of the tenant (city, state, country)';
  END IF;
  
  -- Add logo_url column to tenants table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tenants' AND column_name = 'logo_url') THEN
    ALTER TABLE tenants ADD COLUMN logo_url VARCHAR(500);
    COMMENT ON COLUMN tenants.logo_url IS 'URL to tenant logo image';
  END IF;
  
  -- Add contact_info column to tenants table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tenants' AND column_name = 'contact_info') THEN
    ALTER TABLE tenants ADD COLUMN contact_info JSONB;
    COMMENT ON COLUMN tenants.contact_info IS 'Contact information (email, phone, etc.)';
  END IF;
END $$;

-- Create function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_password_reset_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_password_reset_tokens() IS 'Removes expired password reset tokens older than 24 hours';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens TO eduos_app;
GRANT USAGE, SELECT ON SEQUENCE password_reset_tokens_id_seq TO eduos_app;
