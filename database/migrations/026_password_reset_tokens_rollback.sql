/**
 * Migration 026 Rollback: Password Reset Tokens Table
 * 
 * Removes password reset tokens table and related columns
 */

-- Drop function
DROP FUNCTION IF EXISTS cleanup_expired_password_reset_tokens();

-- Drop table
DROP TABLE IF EXISTS password_reset_tokens CASCADE;

-- Remove columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE users DROP COLUMN IF EXISTS mfa_enabled;
ALTER TABLE users DROP COLUMN IF EXISTS mfa_secret;
ALTER TABLE users DROP COLUMN IF EXISTS failed_login_attempts;
ALTER TABLE users DROP COLUMN IF EXISTS last_failed_login_at;

-- Remove columns from tenants table
ALTER TABLE tenants DROP COLUMN IF EXISTS location;
ALTER TABLE tenants DROP COLUMN IF EXISTS logo_url;
ALTER TABLE tenants DROP COLUMN IF EXISTS contact_info;
