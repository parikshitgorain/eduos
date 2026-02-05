-- Migration: 008_hierarchy_entities.sql
-- Description: Create Institute → Center → Program → Batch hierarchical entity tree
-- Version: 1.0
-- Date: 2026-02-05
-- Task: 2.1.1 - Implement Institute → Center → Program → Batch entity tree

-- ============================================================================
-- PART 1: CREATE HIERARCHY TABLES
-- ============================================================================

-- Institutes table (top level of hierarchy)
CREATE TABLE IF NOT EXISTS institutes (
    institute_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT unique_institute_code_per_tenant UNIQUE (tenant_id, code)
);

-- Centers table (second level - belongs to Institute)
CREATE TABLE IF NOT EXISTS centers (
    center_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT unique_center_code_per_tenant UNIQUE (tenant_id, code)
);

-- Programs table (third level - belongs to Center)
CREATE TABLE IF NOT EXISTS programs (
    program_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES centers(center_id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    duration_months INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT unique_program_code_per_tenant UNIQUE (tenant_id, code)
);

-- Batches table (fourth level - belongs to Program)
CREATE TABLE IF NOT EXISTS batches (
    batch_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(program_id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    start_date DATE,
    end_date DATE,
    capacity INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT unique_batch_code_per_tenant UNIQUE (tenant_id, code),
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ============================================================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Institutes indexes
CREATE INDEX idx_institutes_tenant_id ON institutes(tenant_id);
CREATE INDEX idx_institutes_status ON institutes(tenant_id, status);
CREATE INDEX idx_institutes_code ON institutes(tenant_id, code);

-- Centers indexes
CREATE INDEX idx_centers_tenant_id ON centers(tenant_id);
CREATE INDEX idx_centers_institute_id ON centers(tenant_id, institute_id);
CREATE INDEX idx_centers_status ON centers(tenant_id, status);
CREATE INDEX idx_centers_code ON centers(tenant_id, code);

-- Programs indexes
CREATE INDEX idx_programs_tenant_id ON programs(tenant_id);
CREATE INDEX idx_programs_center_id ON programs(tenant_id, center_id);
CREATE INDEX idx_programs_status ON programs(tenant_id, status);
CREATE INDEX idx_programs_code ON programs(tenant_id, code);

-- Batches indexes
CREATE INDEX idx_batches_tenant_id ON batches(tenant_id);
CREATE INDEX idx_batches_program_id ON batches(tenant_id, program_id);
CREATE INDEX idx_batches_status ON batches(tenant_id, status);
CREATE INDEX idx_batches_code ON batches(tenant_id, code);
CREATE INDEX idx_batches_dates ON batches(tenant_id, start_date, end_date);

-- ============================================================================
-- PART 3: ENABLE ROW-LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 4: CREATE RLS POLICIES
-- ============================================================================

-- Institutes RLS Policies
CREATE POLICY institutes_tenant_isolation ON institutes
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Centers RLS Policies
CREATE POLICY centers_tenant_isolation ON centers
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Programs RLS Policies
CREATE POLICY programs_tenant_isolation ON programs
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Batches RLS Policies
CREATE POLICY batches_tenant_isolation ON batches
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- PART 5: CREATE UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER update_institutes_updated_at
    BEFORE UPDATE ON institutes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_centers_updated_at
    BEFORE UPDATE ON centers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at
    BEFORE UPDATE ON programs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batches_updated_at
    BEFORE UPDATE ON batches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 6: CREATE VALIDATION CONSTRAINTS
-- ============================================================================

-- Ensure center belongs to same tenant as institute
CREATE UNIQUE INDEX IF NOT EXISTS idx_institutes_tenant_institute ON institutes(tenant_id, institute_id);

ALTER TABLE centers
    ADD CONSTRAINT fk_centers_institute_tenant
    FOREIGN KEY (tenant_id, institute_id)
    REFERENCES institutes(tenant_id, institute_id)
    ON DELETE RESTRICT;

-- Ensure program belongs to same tenant as center
CREATE UNIQUE INDEX IF NOT EXISTS idx_centers_tenant_center ON centers(tenant_id, center_id);

ALTER TABLE programs
    ADD CONSTRAINT fk_programs_center_tenant
    FOREIGN KEY (tenant_id, center_id)
    REFERENCES centers(tenant_id, center_id)
    ON DELETE RESTRICT;

-- Ensure batch belongs to same tenant as program
CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_tenant_program ON programs(tenant_id, program_id);

ALTER TABLE batches
    ADD CONSTRAINT fk_batches_program_tenant
    FOREIGN KEY (tenant_id, program_id)
    REFERENCES programs(tenant_id, program_id)
    ON DELETE RESTRICT;

-- Update enrollments table to reference batches properly
ALTER TABLE enrollments
    DROP CONSTRAINT IF EXISTS fk_enrollments_batch;

CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_tenant_batch ON batches(tenant_id, batch_id);

ALTER TABLE enrollments
    ADD CONSTRAINT fk_enrollments_batch_tenant
    FOREIGN KEY (tenant_id, batch_id)
    REFERENCES batches(tenant_id, batch_id)
    ON DELETE RESTRICT;

-- ============================================================================
-- PART 7: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get full hierarchy path for a batch
CREATE OR REPLACE FUNCTION get_batch_hierarchy(p_batch_id UUID)
RETURNS TABLE (
    institute_id UUID,
    institute_name VARCHAR,
    center_id UUID,
    center_name VARCHAR,
    program_id UUID,
    program_name VARCHAR,
    batch_id UUID,
    batch_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.institute_id,
        i.name as institute_name,
        c.center_id,
        c.name as center_name,
        p.program_id,
        p.name as program_name,
        b.batch_id,
        b.name as batch_name
    FROM batches b
    JOIN programs p ON b.program_id = p.program_id
    JOIN centers c ON p.center_id = c.center_id
    JOIN institutes i ON c.institute_id = i.institute_id
    WHERE b.batch_id = p_batch_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check for circular references (validation helper)
CREATE OR REPLACE FUNCTION check_hierarchy_circular_reference()
RETURNS TRIGGER AS $$
BEGIN
    -- This is a safety check, but with our strict parent-child relationships
    -- circular references are structurally impossible
    -- Institute -> Center -> Program -> Batch is a strict tree
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to count children at each level
CREATE OR REPLACE FUNCTION count_hierarchy_children(
    p_entity_type VARCHAR,
    p_entity_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    child_count INTEGER;
BEGIN
    CASE p_entity_type
        WHEN 'institute' THEN
            SELECT COUNT(*) INTO child_count FROM centers WHERE institute_id = p_entity_id;
        WHEN 'center' THEN
            SELECT COUNT(*) INTO child_count FROM programs WHERE center_id = p_entity_id;
        WHEN 'program' THEN
            SELECT COUNT(*) INTO child_count FROM batches WHERE program_id = p_entity_id;
        ELSE
            child_count := 0;
    END CASE;
    
    RETURN child_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 8: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON institutes TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON centers TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON programs TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON batches TO eduos_app;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('008', 'Create Institute → Center → Program → Batch hierarchical entity tree')
ON CONFLICT (version) DO NOTHING;
