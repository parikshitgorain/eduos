-- Migration: 001_setup_rls_foundation.sql
-- Description: Setup PostgreSQL database with Row-Level Security (RLS) policies for multi-tenancy
-- Version: 1.0
-- Date: 2026-02-04

-- ============================================================================
-- PART 1: ENABLE REQUIRED EXTENSIONS
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable cryptographic functions for hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PART 2: CREATE TENANTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    tenant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('Basic', 'Business', 'Enterprise')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast subdomain lookups
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_status ON tenants(status);

-- ============================================================================
-- PART 3: CREATE CORE TABLES WITH TENANT_ID
-- ============================================================================

-- Students table
CREATE TABLE IF NOT EXISTS students (
    student_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    email VARCHAR(255),
    phone VARCHAR(20),
    national_id VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
    enrollment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    batch_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'withdrawn')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    attendance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    event_id UUID NOT NULL,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    marked_by UUID,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    client_timestamp TIMESTAMPTZ,
    device_id VARCHAR(100),
    idempotency_key VARCHAR(255) UNIQUE,
    verification_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    transaction_id VARCHAR(255) UNIQUE,
    webhook_id VARCHAR(255),
    invoice_number VARCHAR(50),
    payment_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- PART 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Students indexes
CREATE INDEX idx_students_tenant_id ON students(tenant_id);
CREATE INDEX idx_students_email ON students(tenant_id, email);
CREATE INDEX idx_students_status ON students(tenant_id, status);
CREATE INDEX idx_students_name ON students(tenant_id, last_name, first_name);

-- Enrollments indexes
CREATE INDEX idx_enrollments_tenant_id ON enrollments(tenant_id);
CREATE INDEX idx_enrollments_student_id ON enrollments(tenant_id, student_id);
CREATE INDEX idx_enrollments_batch_id ON enrollments(tenant_id, batch_id);
CREATE INDEX idx_enrollments_status ON enrollments(tenant_id, status);

-- Attendance indexes
CREATE INDEX idx_attendance_tenant_id ON attendance(tenant_id);
CREATE INDEX idx_attendance_student_id ON attendance(tenant_id, student_id);
CREATE INDEX idx_attendance_date ON attendance(tenant_id, attendance_date);
CREATE INDEX idx_attendance_event_id ON attendance(tenant_id, event_id);
CREATE INDEX idx_attendance_idempotency ON attendance(idempotency_key);

-- Payments indexes
CREATE INDEX idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX idx_payments_student_id ON payments(tenant_id, student_id);
CREATE INDEX idx_payments_status ON payments(tenant_id, payment_status);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_webhook_id ON payments(webhook_id);

-- ============================================================================
-- PART 5: ENABLE ROW-LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all core tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 6: CREATE RLS POLICIES
-- ============================================================================

-- Helper function to get current tenant_id from session
-- This will be set by the application layer via SET LOCAL
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Students RLS Policies
CREATE POLICY students_tenant_isolation ON students
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Enrollments RLS Policies
CREATE POLICY enrollments_tenant_isolation ON enrollments
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Attendance RLS Policies
CREATE POLICY attendance_tenant_isolation ON attendance
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Payments RLS Policies
CREATE POLICY payments_tenant_isolation ON payments
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- PART 7: CREATE AUDIT TRIGGER FUNCTION
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at column
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enrollments_updated_at
    BEFORE UPDATE ON enrollments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 8: CREATE VALIDATION CONSTRAINTS
-- ============================================================================

-- Create composite unique index to support the foreign key constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_tenant_student ON students(tenant_id, student_id);

-- Ensure student belongs to same tenant as enrollment
ALTER TABLE enrollments
    ADD CONSTRAINT fk_enrollments_student_tenant
    FOREIGN KEY (tenant_id, student_id)
    REFERENCES students(tenant_id, student_id)
    ON DELETE CASCADE;

-- Ensure student belongs to same tenant as attendance
ALTER TABLE attendance
    ADD CONSTRAINT fk_attendance_student_tenant
    FOREIGN KEY (tenant_id, student_id)
    REFERENCES students(tenant_id, student_id)
    ON DELETE CASCADE;

-- Ensure student belongs to same tenant as payment
ALTER TABLE payments
    ADD CONSTRAINT fk_payments_student_tenant
    FOREIGN KEY (tenant_id, student_id)
    REFERENCES students(tenant_id, student_id)
    ON DELETE CASCADE;

-- ============================================================================
-- PART 9: GRANT PERMISSIONS
-- ============================================================================

-- Create application role (to be used by the application)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'eduos_app') THEN
        CREATE ROLE eduos_app WITH LOGIN PASSWORD 'change_me_in_production';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO eduos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eduos_app;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Insert migration record
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description)
VALUES ('001', 'Setup RLS foundation with core tables and tenant isolation')
ON CONFLICT (version) DO NOTHING;
