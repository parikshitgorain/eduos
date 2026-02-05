-- Migration: 003_custom_domain_mapping.sql
-- Description: Add tenant_domains table for custom domain mapping
-- Version: 1.0
-- Date: 2026-02-05
-- Task: 1.2.1 - Build custom domain mapping middleware

-- ============================================================================
-- PART 1: CREATE TENANT_DOMAINS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_domains (
    domain_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Domain information
    domain VARCHAR(255) NOT NULL UNIQUE,
    domain_type VARCHAR(20) NOT NULL CHECK (domain_type IN ('subdomain', 'custom')),
    
    -- Verification status
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token VARCHAR(255),
    verified_at TIMESTAMPTZ,
    
    -- SSL/TLS information
    ssl_status VARCHAR(20) DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'active', 'failed', 'expired')),
    ssl_issued_at TIMESTAMPTZ,
    ssl_expires_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary lookup index - critical for performance
CREATE UNIQUE INDEX idx_tenant_domains_domain ON tenant_domains(domain) WHERE is_active = TRUE;

-- Tenant lookup index
CREATE INDEX idx_tenant_domains_tenant_id ON tenant_domains(tenant_id);

-- Verification status index
CREATE INDEX idx_tenant_domains_verification ON tenant_domains(is_verified, is_active);

-- Domain type index
CREATE INDEX idx_tenant_domains_type ON tenant_domains(domain_type);

-- ============================================================================
-- PART 3: CREATE TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_tenant_domains_updated_at
    BEFORE UPDATE ON tenant_domains
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 4: CREATE FUNCTION TO RESOLVE DOMAIN TO TENANT
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_domain_to_tenant(input_domain VARCHAR)
RETURNS TABLE (
    tenant_id UUID,
    tenant_name VARCHAR,
    tenant_tier VARCHAR,
    tenant_status VARCHAR,
    domain_type VARCHAR,
    is_verified BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tenant_id,
        t.name AS tenant_name,
        t.tier AS tenant_tier,
        t.status AS tenant_status,
        td.domain_type,
        td.is_verified
    FROM tenant_domains td
    INNER JOIN tenants t ON td.tenant_id = t.tenant_id
    WHERE td.domain = LOWER(input_domain)
      AND td.is_active = TRUE
      AND t.status = 'active';
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 5: CREATE FUNCTION TO ADD DEFAULT SUBDOMAIN
-- ============================================================================

CREATE OR REPLACE FUNCTION add_default_subdomain()
RETURNS TRIGGER AS $$
DECLARE
    subdomain_full VARCHAR(255);
BEGIN
    -- Construct full subdomain (e.g., "school.eduos.com")
    subdomain_full := NEW.subdomain || '.eduos.com';
    
    -- Insert default subdomain mapping
    INSERT INTO tenant_domains (
        tenant_id,
        domain,
        domain_type,
        is_verified,
        verified_at,
        is_active
    ) VALUES (
        NEW.tenant_id,
        subdomain_full,
        'subdomain',
        TRUE,  -- Subdomains are auto-verified
        NOW(),
        TRUE
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 6: CREATE TRIGGER TO AUTO-CREATE SUBDOMAIN
-- ============================================================================

-- Automatically create subdomain mapping when tenant is created
CREATE TRIGGER create_default_subdomain_after_tenant_insert
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION add_default_subdomain();

-- ============================================================================
-- PART 7: BACKFILL EXISTING TENANTS
-- ============================================================================

-- Add subdomain mappings for existing tenants
INSERT INTO tenant_domains (tenant_id, domain, domain_type, is_verified, verified_at, is_active)
SELECT 
    tenant_id,
    subdomain || '.eduos.com' AS domain,
    'subdomain' AS domain_type,
    TRUE AS is_verified,
    NOW() AS verified_at,
    TRUE AS is_active
FROM tenants
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_domains td 
    WHERE td.tenant_id = tenants.tenant_id 
    AND td.domain = tenants.subdomain || '.eduos.com'
);

-- ============================================================================
-- PART 8: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_domains TO eduos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eduos_app;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('003', 'Add tenant_domains table for custom domain mapping')
ON CONFLICT (version) DO NOTHING;
