/**
 * Migration 024: Performance Optimization Indexes
 * 
 * Task: 4.4.4 - Setup performance optimization and caching
 * 
 * Creates indexes on frequently queried columns to improve query performance.
 * Target: p95 < 200ms, p99 < 500ms for API responses
 * 
 * This migration creates indexes based on the ACTUAL existing schema.
 */

-- ============================================================================
-- SCHEMA SNAPSHOTS INDEXES
-- ============================================================================

-- Index for schema snapshot lookups by snapshot_id (most common query)
CREATE INDEX IF NOT EXISTS idx_schema_snapshots_snapshot_id 
ON schema_snapshots(snapshot_id);

-- Index for schema snapshot by tenant_id
CREATE INDEX IF NOT EXISTS idx_schema_snapshots_tenant 
ON schema_snapshots(tenant_id);

-- Index for schema snapshot by form_type
CREATE INDEX IF NOT EXISTS idx_schema_snapshots_form_type 
ON schema_snapshots(tenant_id, form_type);

-- Index for schema snapshot hash lookups (integrity verification)
CREATE INDEX IF NOT EXISTS idx_schema_snapshots_hash 
ON schema_snapshots(schema_hash);

-- Index for schema snapshot by created_at (for version history)
CREATE INDEX IF NOT EXISTS idx_schema_snapshots_created 
ON schema_snapshots(tenant_id, created_at DESC);

-- ============================================================================
-- HIERARCHY INDEXES (Institutes, Centers, Programs, Batches)
-- ============================================================================

-- Institutes
CREATE INDEX IF NOT EXISTS idx_institutes_tenant 
ON institutes(tenant_id);

-- Centers
CREATE INDEX IF NOT EXISTS idx_centers_tenant 
ON centers(tenant_id);

CREATE INDEX IF NOT EXISTS idx_centers_institute 
ON centers(institute_id);

-- Programs
CREATE INDEX IF NOT EXISTS idx_programs_tenant 
ON programs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_programs_center 
ON programs(center_id);

-- Batches
CREATE INDEX IF NOT EXISTS idx_batches_tenant 
ON batches(tenant_id);

CREATE INDEX IF NOT EXISTS idx_batches_program 
ON batches(program_id);

-- ============================================================================
-- STUDENTS INDEXES
-- ============================================================================

-- Index for student lookups by tenant
CREATE INDEX IF NOT EXISTS idx_students_tenant 
ON students(tenant_id);

-- Index for student email lookups (unique per tenant)
CREATE INDEX IF NOT EXISTS idx_students_email 
ON students(tenant_id, email);

-- Index for student national_id lookups (duplicate detection)
CREATE INDEX IF NOT EXISTS idx_students_national_id 
ON students(tenant_id, national_id) 
WHERE national_id IS NOT NULL;

-- Index for student name searches (duplicate detection)
CREATE INDEX IF NOT EXISTS idx_students_name 
ON students(tenant_id, first_name, last_name);

-- Index for student date of birth (duplicate detection)
CREATE INDEX IF NOT EXISTS idx_students_dob 
ON students(tenant_id, date_of_birth) 
WHERE date_of_birth IS NOT NULL;

-- Composite index for duplicate detection queries
CREATE INDEX IF NOT EXISTS idx_students_duplicate_check 
ON students(tenant_id, first_name, last_name, date_of_birth);

-- Index for merged students
CREATE INDEX IF NOT EXISTS idx_students_merged 
ON students(merged_into) 
WHERE merged_into IS NOT NULL;

-- ============================================================================
-- ENROLLMENTS INDEXES
-- ============================================================================

-- Index for enrollment lookups by student
CREATE INDEX IF NOT EXISTS idx_enrollments_student 
ON enrollments(student_id);

-- Index for enrollment lookups by batch
CREATE INDEX IF NOT EXISTS idx_enrollments_batch 
ON enrollments(batch_id);

-- Index for enrollment lookups by tenant
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant 
ON enrollments(tenant_id);

-- ============================================================================
-- ATTENDANCE INDEXES
-- ============================================================================

-- Index for attendance by student and date
CREATE INDEX IF NOT EXISTS idx_attendance_student_date 
ON attendance(student_id, attendance_date);

-- Index for attendance by event
CREATE INDEX IF NOT EXISTS idx_attendance_event 
ON attendance(event_id, attendance_date);

-- Index for attendance by tenant and date (reporting)
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_date 
ON attendance(tenant_id, attendance_date);

-- Index for attendance idempotency key (duplicate prevention)
CREATE INDEX IF NOT EXISTS idx_attendance_idempotency 
ON attendance(idempotency_key);

-- Index for attendance verification required
CREATE INDEX IF NOT EXISTS idx_attendance_verification 
ON attendance(tenant_id, verification_required) 
WHERE verification_required = true;

-- ============================================================================
-- PAYMENTS INDEXES
-- ============================================================================

-- Index for payment lookups by tenant and status
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status 
ON payments(tenant_id, payment_status, created_at);

-- Index for payment lookups by student
CREATE INDEX IF NOT EXISTS idx_payments_student 
ON payments(student_id, created_at DESC);

-- Index for payment lookups by transaction_id
CREATE INDEX IF NOT EXISTS idx_payments_transaction 
ON payments(transaction_id);

-- Index for payment webhook_id (webhook processing)
CREATE INDEX IF NOT EXISTS idx_payments_webhook 
ON payments(webhook_id);

-- Index for payment invoice_number
CREATE INDEX IF NOT EXISTS idx_payments_invoice 
ON payments(invoice_number);

-- ============================================================================
-- AUDIT LOGS INDEXES
-- ============================================================================

-- Index for audit log lookups by tenant and timestamp
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_timestamp 
ON audit_logs(tenant_id, created_at DESC);

-- Index for audit log lookups by user
CREATE INDEX IF NOT EXISTS idx_audit_logs_user 
ON audit_logs(user_id, created_at DESC);

-- Index for audit log lookups by action
CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
ON audit_logs(tenant_id, action, created_at DESC);

-- Index for audit log lookups by resource
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource 
ON audit_logs(tenant_id, resource_type, resource_id);

-- Index for audit log lookups by event type
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type 
ON audit_logs(tenant_id, event_type, created_at DESC);

-- ============================================================================
-- SESSIONS INDEXES
-- ============================================================================

-- Index for session lookups by user
CREATE INDEX IF NOT EXISTS idx_sessions_user 
ON sessions(user_id, tenant_id);

-- ============================================================================
-- TENANT DOMAINS INDEXES
-- ============================================================================

-- Index for domain mapping lookups
CREATE INDEX IF NOT EXISTS idx_tenant_domains_domain 
ON tenant_domains(domain);

-- Index for tenant domain lookups
CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant 
ON tenant_domains(tenant_id);

-- ============================================================================
-- USERS INDEXES
-- ============================================================================

-- Index for user lookups by email
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

-- Index for user lookups by tenant
CREATE INDEX IF NOT EXISTS idx_users_tenant 
ON users(tenant_id);

-- ============================================================================
-- MERGE SNAPSHOTS INDEXES
-- ============================================================================

-- Index for merge snapshot lookups by tenant
CREATE INDEX IF NOT EXISTS idx_merge_snapshots_tenant 
ON merge_snapshots(tenant_id, created_at DESC);

-- Index for merge snapshot hash verification
CREATE INDEX IF NOT EXISTS idx_merge_snapshots_hash 
ON merge_snapshots(snapshot_hash);

-- ============================================================================
-- DUPLICATE REVIEW QUEUE INDEXES
-- ============================================================================

-- Index for duplicate queue by status
CREATE INDEX IF NOT EXISTS idx_duplicate_queue_status 
ON duplicate_review_queue(tenant_id, status, likelihood_score DESC);

-- ============================================================================
-- VACUUM AND ANALYZE
-- ============================================================================

-- Analyze all tables to update statistics
ANALYZE students;
ANALYZE enrollments;
ANALYZE attendance;
ANALYZE payments;
ANALYZE audit_logs;
ANALYZE schema_snapshots;
ANALYZE institutes;
ANALYZE centers;
ANALYZE programs;
ANALYZE batches;
ANALYZE tenant_domains;
ANALYZE users;
ANALYZE merge_snapshots;
ANALYZE duplicate_review_queue;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_schema_snapshots_snapshot_id IS 'Performance: Schema snapshot lookups by ID';
COMMENT ON INDEX idx_students_duplicate_check IS 'Performance: Duplicate detection queries';
COMMENT ON INDEX idx_attendance_student_date IS 'Performance: Attendance queries by student and date';
COMMENT ON INDEX idx_payments_tenant_status IS 'Performance: Payment queries by tenant and status';
COMMENT ON INDEX idx_audit_logs_tenant_timestamp IS 'Performance: Audit log queries by tenant and time';

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 024: Performance indexes created successfully';
  RAISE NOTICE 'Run EXPLAIN ANALYZE on your queries to verify index usage';
  RAISE NOTICE 'Monitor pg_stat_user_indexes to track index effectiveness';
END $$;
