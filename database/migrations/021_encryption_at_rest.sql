-- ============================================================================
-- Migration 021: Encryption at Rest
-- Task: 4.3.3 - Implement encryption at rest and in transit
-- ============================================================================
-- Description:
--   Adds support for field-level encryption of sensitive data:
--   - national_id
--   - medical_history
--   - payment_info
--
--   Implements key management and rotation tracking
-- ============================================================================

-- Create encryption keys tracking table
CREATE TABLE IF NOT EXISTS encryption_keys (
  key_id SERIAL PRIMARY KEY,
  key_version INTEGER NOT NULL UNIQUE,
  key_fingerprint VARCHAR(64) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMP,
  CONSTRAINT unique_active_key UNIQUE (is_active) WHERE is_active = true
);

-- Add comment
COMMENT ON TABLE encryption_keys IS 'Tracks encryption key versions and rotation history';
COMMENT ON COLUMN encryption_keys.key_version IS 'Incremental version number for key rotation';
COMMENT ON COLUMN encryption_keys.key_fingerprint IS 'SHA-256 fingerprint of the encryption key for audit';
COMMENT ON COLUMN encryption_keys.is_active IS 'Only one key can be active at a time';
COMMENT ON COLUMN encryption_keys.rotated_at IS 'Timestamp when key was rotated (deactivated)';

-- Add encrypted fields to students table
ALTER TABLE students 
  ADD COLUMN IF NOT EXISTS national_id_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS medical_history_encrypted TEXT;

-- Add comments
COMMENT ON COLUMN students.national_id_encrypted IS 'Encrypted national ID (Aadhaar, PAN, etc.) - AES-256-GCM';
COMMENT ON COLUMN students.medical_history_encrypted IS 'Encrypted medical history - AES-256-GCM';

-- Add encrypted fields to payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_info_encrypted TEXT;

-- Add comment
COMMENT ON COLUMN payments.payment_info_encrypted IS 'Encrypted payment information (card details, UPI, etc.) - AES-256-GCM';

-- Create index for encrypted field queries (on tenant_id, not on encrypted data)
CREATE INDEX IF NOT EXISTS idx_students_encrypted_fields 
  ON students(tenant_id) 
  WHERE national_id_encrypted IS NOT NULL OR medical_history_encrypted IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_encrypted_fields 
  ON payments(tenant_id) 
  WHERE payment_info_encrypted IS NOT NULL;

-- Create audit log for encryption operations
CREATE TABLE IF NOT EXISTS encryption_audit_log (
  audit_id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  operation VARCHAR(50) NOT NULL, -- 'encrypt', 'decrypt', 'rotate', 're-encrypt'
  field_type VARCHAR(50) NOT NULL, -- 'national_id', 'medical_history', 'payment_info'
  record_id UUID NOT NULL,
  key_version INTEGER NOT NULL,
  performed_by UUID,
  performed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT
);

-- Add RLS policy for encryption audit log
ALTER TABLE encryption_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY encryption_audit_tenant_isolation ON encryption_audit_log
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- Create index for audit log queries
CREATE INDEX idx_encryption_audit_tenant ON encryption_audit_log(tenant_id, performed_at DESC);
CREATE INDEX idx_encryption_audit_operation ON encryption_audit_log(operation, performed_at DESC);
CREATE INDEX idx_encryption_audit_field_type ON encryption_audit_log(field_type, performed_at DESC);

-- Add comments
COMMENT ON TABLE encryption_audit_log IS 'Audit trail for all encryption/decryption operations';
COMMENT ON COLUMN encryption_audit_log.operation IS 'Type of encryption operation performed';
COMMENT ON COLUMN encryption_audit_log.field_type IS 'Type of sensitive field being encrypted/decrypted';
COMMENT ON COLUMN encryption_audit_log.record_id IS 'ID of the record being encrypted/decrypted';
COMMENT ON COLUMN encryption_audit_log.key_version IS 'Version of encryption key used';

-- Function to log encryption operations
CREATE OR REPLACE FUNCTION log_encryption_operation(
  p_tenant_id UUID,
  p_operation VARCHAR(50),
  p_field_type VARCHAR(50),
  p_record_id UUID,
  p_key_version INTEGER,
  p_performed_by UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO encryption_audit_log (
    tenant_id, operation, field_type, record_id, key_version,
    performed_by, ip_address, user_agent, success, error_message
  ) VALUES (
    p_tenant_id, p_operation, p_field_type, p_record_id, p_key_version,
    p_performed_by, p_ip_address, p_user_agent, p_success, p_error_message
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_encryption_operation TO eduos_app;

-- Create view for encryption key rotation status
CREATE OR REPLACE VIEW encryption_key_status AS
SELECT 
  key_version,
  key_fingerprint,
  is_active,
  created_at,
  rotated_at,
  CASE 
    WHEN is_active THEN 
      EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 -- Days since creation
    ELSE 
      EXTRACT(EPOCH FROM (rotated_at - created_at)) / 86400 -- Days active before rotation
  END AS days_active,
  CASE 
    WHEN is_active AND EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 >= 90 THEN true
    ELSE false
  END AS rotation_needed
FROM encryption_keys
ORDER BY key_version DESC;

-- Add comment
COMMENT ON VIEW encryption_key_status IS 'Shows current encryption key status and rotation requirements';

-- Grant permissions
GRANT SELECT ON encryption_key_status TO eduos_app;

-- Insert initial encryption key record (will be updated by application)
INSERT INTO encryption_keys (key_version, key_fingerprint, is_active, created_at)
VALUES (1, 'initial_key_fingerprint_to_be_updated', true, NOW())
ON CONFLICT (key_version) DO NOTHING;

-- Create function to check if key rotation is needed
CREATE OR REPLACE FUNCTION check_key_rotation_needed() RETURNS BOOLEAN AS $$
DECLARE
  v_days_active NUMERIC;
BEGIN
  SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400
  INTO v_days_active
  FROM encryption_keys
  WHERE is_active = true
  ORDER BY key_version DESC
  LIMIT 1;
  
  RETURN v_days_active >= 90;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_key_rotation_needed TO eduos_app;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 021: Encryption at Rest - Completed Successfully';
  RAISE NOTICE 'Added encryption support for sensitive fields:';
  RAISE NOTICE '  - students.national_id_encrypted';
  RAISE NOTICE '  - students.medical_history_encrypted';
  RAISE NOTICE '  - payments.payment_info_encrypted';
  RAISE NOTICE 'Created encryption_keys table for key management';
  RAISE NOTICE 'Created encryption_audit_log for audit trail';
  RAISE NOTICE 'Key rotation interval: 90 days';
END $$;
