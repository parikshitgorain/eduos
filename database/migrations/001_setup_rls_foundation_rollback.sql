-- Rollback Migration: 001_setup_rls_foundation_rollback.sql
-- Description: Rollback RLS foundation setup
-- Version: 1.0
-- Date: 2026-02-04

-- ============================================================================
-- ROLLBACK SCRIPT - Execute in reverse order of creation
-- ============================================================================

-- Drop validation constraints
ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_payments_student_tenant;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS fk_attendance_student_tenant;
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS fk_enrollments_student_tenant;

-- Drop composite unique index
DROP INDEX IF EXISTS idx_students_tenant_student;

-- Drop triggers
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS update_enrollments_updated_at ON enrollments;
DROP TRIGGER IF EXISTS update_students_updated_at ON students;
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop RLS policies
DROP POLICY IF EXISTS payments_tenant_isolation ON payments;
DROP POLICY IF EXISTS attendance_tenant_isolation ON attendance;
DROP POLICY IF EXISTS enrollments_tenant_isolation ON enrollments;
DROP POLICY IF EXISTS students_tenant_isolation ON students;

-- Drop helper function
DROP FUNCTION IF EXISTS current_tenant_id();

-- Disable RLS
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;

-- Drop indexes
DROP INDEX IF EXISTS idx_payments_webhook_id;
DROP INDEX IF EXISTS idx_payments_transaction_id;
DROP INDEX IF EXISTS idx_payments_status;
DROP INDEX IF EXISTS idx_payments_student_id;
DROP INDEX IF EXISTS idx_payments_tenant_id;

DROP INDEX IF EXISTS idx_attendance_idempotency;
DROP INDEX IF EXISTS idx_attendance_event_id;
DROP INDEX IF EXISTS idx_attendance_date;
DROP INDEX IF EXISTS idx_attendance_student_id;
DROP INDEX IF EXISTS idx_attendance_tenant_id;

DROP INDEX IF EXISTS idx_enrollments_status;
DROP INDEX IF EXISTS idx_enrollments_batch_id;
DROP INDEX IF EXISTS idx_enrollments_student_id;
DROP INDEX IF EXISTS idx_enrollments_tenant_id;

DROP INDEX IF EXISTS idx_students_name;
DROP INDEX IF EXISTS idx_students_status;
DROP INDEX IF EXISTS idx_students_email;
DROP INDEX IF EXISTS idx_students_tenant_id;

DROP INDEX IF EXISTS idx_tenants_status;
DROP INDEX IF EXISTS idx_tenants_subdomain;

-- Drop tables
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Revoke permissions
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM eduos_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM eduos_app;
REVOKE USAGE ON SCHEMA public FROM eduos_app;

-- Drop role (commented out for safety - may be used by other objects)
-- DROP ROLE IF EXISTS eduos_app;

-- Drop extensions (commented out for safety - may be used by other objects)
-- DROP EXTENSION IF EXISTS "pgcrypto";
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '001';

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
