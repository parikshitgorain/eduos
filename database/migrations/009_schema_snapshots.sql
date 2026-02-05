-- Migration: 009_schema_snapshots.sql
-- Description: Create schema definition and storage system for dynamic forms
-- Version: 1.0
-- Date: 2026-02-05
-- Task: 2.2.1 - Build schema definition and storage system

-- ============================================================================
-- PART 1: CREATE SCHEMA_SNAPSHOTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    form_type VARCHAR(100) NOT NULL, -- e.g., 'student_enrollment', 'attendance', 'assessment'
    semantic_version VARCHAR(20) NOT NULL, -- SemVer format: v1.2.3
    schema_hash CHAR(64) NOT NULL, -- SHA-256 hex for integrity verification
    schema_definition JSONB NOT NULL, -- Full JSON schema with fields, validation rules, etc.
    parent_snapshot_id UUID REFERENCES schema_snapshots(snapshot_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(user_id),
    change_summary TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT unique_form_version_per_tenant UNIQUE (tenant_id, form_type, semantic_version)
);

-- ============================================================================
-- PART 2: CREATE FIELD_DEFINITIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS field_definitions (
    field_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_id UUID NOT NULL REFERENCES schema_snapshots(snapshot_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'checkbox', 'file_upload', 'email', 'phone', 'textarea', 'radio')),
    label VARCHAR(255) NOT NULL,
    description TEXT,
    placeholder VARCHAR(255),
    default_value TEXT,
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_unique BOOLEAN NOT NULL DEFAULT false,
    is_encrypted BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    validation_rules JSONB DEFAULT '{}'::jsonb, -- min, max, regex, custom validators
    field_options JSONB DEFAULT '{}'::jsonb, -- For dropdown, radio, checkbox options
    permissions JSONB DEFAULT '{}'::jsonb, -- visible_to_roles, editable_by_roles
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_field_name_per_snapshot UNIQUE (snapshot_id, field_name)
);

-- ============================================================================
-- PART 3: CREATE VALIDATION_RULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS validation_rules (
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_id UUID NOT NULL REFERENCES field_definitions(field_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('required', 'min', 'max', 'min_length', 'max_length', 'regex', 'email', 'phone', 'url', 'custom')),
    rule_value TEXT, -- The value for the rule (e.g., min value, regex pattern)
    error_message VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PART 4: CREATE SCHEMA_EXPORTS TABLE (for portability)
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_exports (
    export_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_id UUID NOT NULL REFERENCES schema_snapshots(snapshot_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    export_format VARCHAR(20) NOT NULL DEFAULT 'json' CHECK (export_format IN ('json', 'yaml')),
    export_data JSONB NOT NULL,
    exported_by UUID NOT NULL REFERENCES users(user_id),
    exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- PART 5: CREATE SCHEMA_IMPORTS TABLE (for portability)
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_imports (
    import_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    import_format VARCHAR(20) NOT NULL DEFAULT 'json' CHECK (import_format IN ('json', 'yaml')),
    import_data JSONB NOT NULL,
    import_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (import_status IN ('pending', 'success', 'partial', 'failed')),
    result_snapshot_id UUID REFERENCES schema_snapshots(snapshot_id),
    imported_by UUID NOT NULL REFERENCES users(user_id),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_log TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- PART 6: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Schema snapshots indexes
CREATE INDEX idx_schema_snapshots_tenant_id ON schema_snapshots(tenant_id);
CREATE INDEX idx_schema_snapshots_form_type ON schema_snapshots(tenant_id, form_type);
CREATE INDEX idx_schema_snapshots_status ON schema_snapshots(tenant_id, status);
CREATE INDEX idx_schema_snapshots_created_at ON schema_snapshots(tenant_id, created_at DESC);
CREATE INDEX idx_schema_snapshots_parent ON schema_snapshots(parent_snapshot_id);
CREATE INDEX idx_schema_snapshots_hash ON schema_snapshots(schema_hash);

-- Field definitions indexes
CREATE INDEX idx_field_definitions_snapshot_id ON field_definitions(snapshot_id);
CREATE INDEX idx_field_definitions_tenant_id ON field_definitions(tenant_id);
CREATE INDEX idx_field_definitions_field_name ON field_definitions(snapshot_id, field_name);
CREATE INDEX idx_field_definitions_display_order ON field_definitions(snapshot_id, display_order);

-- Validation rules indexes
CREATE INDEX idx_validation_rules_field_id ON validation_rules(field_id);
CREATE INDEX idx_validation_rules_tenant_id ON validation_rules(tenant_id);
CREATE INDEX idx_validation_rules_active ON validation_rules(field_id, is_active);

-- Schema exports indexes
CREATE INDEX idx_schema_exports_snapshot_id ON schema_exports(snapshot_id);
CREATE INDEX idx_schema_exports_tenant_id ON schema_exports(tenant_id);
CREATE INDEX idx_schema_exports_exported_at ON schema_exports(tenant_id, exported_at DESC);

-- Schema imports indexes
CREATE INDEX idx_schema_imports_tenant_id ON schema_imports(tenant_id);
CREATE INDEX idx_schema_imports_status ON schema_imports(tenant_id, import_status);
CREATE INDEX idx_schema_imports_imported_at ON schema_imports(tenant_id, imported_at DESC);

-- ============================================================================
-- PART 7: ENABLE ROW-LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE schema_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_imports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 8: CREATE RLS POLICIES
-- ============================================================================

-- Schema snapshots RLS policies
CREATE POLICY schema_snapshots_tenant_isolation ON schema_snapshots
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Field definitions RLS policies
CREATE POLICY field_definitions_tenant_isolation ON field_definitions
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Validation rules RLS policies
CREATE POLICY validation_rules_tenant_isolation ON validation_rules
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Schema exports RLS policies
CREATE POLICY schema_exports_tenant_isolation ON schema_exports
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Schema imports RLS policies
CREATE POLICY schema_imports_tenant_isolation ON schema_imports
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- PART 9: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to compute SHA-256 hash of schema definition
CREATE OR REPLACE FUNCTION compute_schema_hash(schema_json JSONB)
RETURNS TEXT AS $$
BEGIN
    -- Convert JSONB to canonical JSON string (sorted keys, no whitespace)
    -- Then compute SHA-256 hash
    RETURN encode(digest(schema_json::text, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get latest active schema for a form type
CREATE OR REPLACE FUNCTION get_latest_schema(p_tenant_id UUID, p_form_type VARCHAR)
RETURNS UUID AS $$
DECLARE
    latest_snapshot_id UUID;
BEGIN
    SELECT snapshot_id INTO latest_snapshot_id
    FROM schema_snapshots
    WHERE tenant_id = p_tenant_id
      AND form_type = p_form_type
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN latest_snapshot_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to verify schema integrity
CREATE OR REPLACE FUNCTION verify_schema_integrity(p_snapshot_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    stored_hash TEXT;
    computed_hash TEXT;
    schema_def JSONB;
BEGIN
    SELECT schema_hash, schema_definition INTO stored_hash, schema_def
    FROM schema_snapshots
    WHERE snapshot_id = p_snapshot_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schema snapshot not found: %', p_snapshot_id;
    END IF;
    
    computed_hash := compute_schema_hash(schema_def);
    
    RETURN stored_hash = computed_hash;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get schema version history
CREATE OR REPLACE FUNCTION get_schema_version_history(p_tenant_id UUID, p_form_type VARCHAR)
RETURNS TABLE (
    snapshot_id UUID,
    semantic_version VARCHAR,
    created_at TIMESTAMPTZ,
    created_by UUID,
    change_summary TEXT,
    status VARCHAR,
    parent_snapshot_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.snapshot_id,
        s.semantic_version,
        s.created_at,
        s.created_by,
        s.change_summary,
        s.status,
        s.parent_snapshot_id
    FROM schema_snapshots s
    WHERE s.tenant_id = p_tenant_id
      AND s.form_type = p_form_type
    ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get all fields for a schema snapshot
CREATE OR REPLACE FUNCTION get_schema_fields(p_snapshot_id UUID)
RETURNS TABLE (
    field_id UUID,
    field_name VARCHAR,
    field_type VARCHAR,
    label VARCHAR,
    description TEXT,
    is_required BOOLEAN,
    display_order INTEGER,
    validation_rules JSONB,
    field_options JSONB,
    permissions JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.field_id,
        f.field_name,
        f.field_type,
        f.label,
        f.description,
        f.is_required,
        f.display_order,
        f.validation_rules,
        f.field_options,
        f.permissions
    FROM field_definitions f
    WHERE f.snapshot_id = p_snapshot_id
    ORDER BY f.display_order ASC, f.field_name ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 10: CREATE TRIGGERS
-- ============================================================================

-- Trigger to automatically compute schema hash on insert
CREATE OR REPLACE FUNCTION auto_compute_schema_hash()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.schema_hash IS NULL OR NEW.schema_hash = '' THEN
        NEW.schema_hash := compute_schema_hash(NEW.schema_definition);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_compute_schema_hash
    BEFORE INSERT ON schema_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION auto_compute_schema_hash();

-- ============================================================================
-- PART 11: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON schema_snapshots TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON field_definitions TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON validation_rules TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON schema_exports TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON schema_imports TO eduos_app;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('009', 'Create schema definition and storage system for dynamic forms')
ON CONFLICT (version) DO NOTHING;
