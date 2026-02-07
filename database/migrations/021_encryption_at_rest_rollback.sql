-- ============================================================================
-- Migration 021 Rollback: Encryption at Rest
-- Task: 4.3.3 - Implement encryption at rest and in transit
-- ============================================================================

-- Drop function
DROP FUNCTION IF EXISTS check_key_rotation_needed();

-- Drop view
DROP VIEW IF EXISTS encryption_key_status;

-- Drop function
DROP FUNCTION IF EXISTS log_encryption_operation(UUID, VARCHAR, VARCHAR, UUID, INTEGER, UUID, INET, TEXT, BOOLEAN, TEXT);

-- Drop indexes
DROP INDEX IF EXISTS idx_encryption_audit_field_type;
DROP INDEX IF EXISTS idx_encryption_audit_operation;
DROP INDEX IF EXISTS idx_encryption_audit_tenant;
DROP INDEX IF EXISTS idx_payments_encrypted_fields;
DROP INDEX IF EXISTS idx_students_encrypted_fields;

-- Drop audit log table
DROP TABLE IF EXISTS encryption_audit_log;

-- Remove encrypted columns from payments table
ALTER TABLE payments
  DROP COLUMN IF EXISTS payment_info_encrypted;

-- Remove encrypted columns from students table
ALTER TABLE students
  DROP COLUMN IF EXISTS medical_history_encrypted,
  DROP COLUMN IF EXISTS national_id_encrypted;

-- Drop encryption keys table
DROP TABLE IF EXISTS encryption_keys;

-- Log rollback
DO $$
BEGIN
  RAISE NOTICE 'Migration 021 Rollback: Encryption at Rest - Completed';
  RAISE NOTICE 'Removed all encryption-related tables and columns';
  RAISE NOTICE 'WARNING: Any encrypted data has been permanently removed';
END $$;
