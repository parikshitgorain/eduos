/**
 * Migration 024 Rollback: Remove Performance Optimization Indexes
 * 
 * Task: 4.4.4 - Setup performance optimization and caching
 * 
 * Removes all performance indexes created in migration 024.
 */

-- ============================================================================
-- DROP SCHEMA INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_schema_snapshots_snapshot_id;
DROP INDEX IF EXISTS idx_schema_snapshots_tenant;
DROP INDEX IF EXISTS idx_schema_snapshots_form_type;
DROP INDEX IF EXISTS idx_schema_snapshots_hash;

-- ============================================================================
-- DROP HIERARCHY INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_institutes_tenant;
DROP INDEX IF EXISTS idx_centers_tenant;
DROP INDEX IF EXISTS idx_centers_institute;
DROP INDEX IF EXISTS idx_programs_tenant;
DROP INDEX IF EXISTS idx_programs_center;
DROP INDEX IF EXISTS idx_batches_tenant;
DROP INDEX IF EXISTS idx_batches_program;

-- ============================================================================
-- DROP STUDENT INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_students_tenant;
DROP INDEX IF EXISTS idx_students_email;
DROP INDEX IF EXISTS idx_students_national_id;
DROP INDEX IF EXISTS idx_students_name;
DROP INDEX IF EXISTS idx_students_dob;
DROP INDEX IF EXISTS idx_students_duplicate_check;

-- ============================================================================
-- DROP ENROLLMENT INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_enrollments_student;
DROP INDEX IF EXISTS idx_enrollments_batch;
DROP INDEX IF EXISTS idx_enrollments_active;
DROP INDEX IF EXISTS idx_enrollments_dates;

-- ============================================================================
-- DROP ATTENDANCE INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_attendance_student_date;
DROP INDEX IF EXISTS idx_attendance_event;
DROP INDEX IF EXISTS idx_attendance_batch_date;
DROP INDEX IF EXISTS idx_attendance_sync_status;
DROP INDEX IF EXISTS idx_attendance_idempotency;

-- ============================================================================
-- DROP PAYMENT INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_payments_tenant_status;
DROP INDEX IF EXISTS idx_payments_student;
DROP INDEX IF EXISTS idx_payments_invoice;
DROP INDEX IF EXISTS idx_payments_gateway_ref;
DROP INDEX IF EXISTS idx_payments_pending;

-- ============================================================================
-- DROP INVOICE INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_invoices_tenant_number;
DROP INDEX IF EXISTS idx_invoices_student;
DROP INDEX IF EXISTS idx_invoices_status_date;

-- ============================================================================
-- DROP AUDIT LOG INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_audit_logs_tenant_timestamp;
DROP INDEX IF EXISTS idx_audit_logs_user;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_resource;
DROP INDEX IF EXISTS idx_audit_logs_hash;

-- ============================================================================
-- DROP SESSION INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_sessions_user;
DROP INDEX IF EXISTS idx_sessions_expired;

-- ============================================================================
-- DROP TENANT DOMAIN INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_tenant_domains_domain;
DROP INDEX IF EXISTS idx_tenant_domains_tenant;

-- ============================================================================
-- DROP USER INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_tenant;
DROP INDEX IF EXISTS idx_user_roles_user;

-- ============================================================================
-- DROP MERGE SNAPSHOT INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_merge_snapshots_tenant;
DROP INDEX IF EXISTS idx_merge_snapshots_hash;

-- ============================================================================
-- DROP DUPLICATE QUEUE INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_duplicate_queue_status;

-- ============================================================================
-- DROP PERFORMANCE MONITORING FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS analyze_query_performance();
DROP FUNCTION IF EXISTS check_index_usage();

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 024 Rollback: Performance indexes removed successfully';
END $$;
