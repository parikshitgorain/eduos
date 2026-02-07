-- Migration 023: Backup and Disaster Recovery System
-- 
-- Creates tables and functions for managing automated backups,
-- Point-in-Time Recovery (PITR), and disaster recovery procedures.

-- ============================================================================
-- BACKUPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY,
  backup_id VARCHAR(100) UNIQUE NOT NULL,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('Basic', 'Business', 'Enterprise')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed', 'expired')),
  backup_type VARCHAR(50) DEFAULT 'full' CHECK (backup_type IN ('full', 'incremental', 'differential')),
  
  -- Backup metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Retention
  retention_days INTEGER NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes
  CONSTRAINT valid_retention CHECK (retention_days > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_backups_tier ON backups(tier) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_backups_expires_at ON backups(expires_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- BACKUP COMPONENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS backup_components (
  id SERIAL PRIMARY KEY,
  backup_id VARCHAR(100) NOT NULL REFERENCES backups(backup_id) ON DELETE CASCADE,
  component_name VARCHAR(50) NOT NULL CHECK (component_name IN ('postgresql', 'redis', 'file_storage')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  
  -- Component details
  file_path TEXT,
  file_size BIGINT DEFAULT 0,
  checksum VARCHAR(64),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  UNIQUE(backup_id, component_name)
);

CREATE INDEX IF NOT EXISTS idx_backup_components_backup_id ON backup_components(backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_components_status ON backup_components(status);

-- ============================================================================
-- DISASTER RECOVERY DRILLS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dr_drills (
  id SERIAL PRIMARY KEY,
  drill_id VARCHAR(100) UNIQUE NOT NULL,
  drill_type VARCHAR(50) NOT NULL CHECK (drill_type IN ('tabletop', 'partial_failover', 'full_failover')),
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('Basic', 'Business', 'Enterprise')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'failed')),
  
  -- Drill details
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Results
  rto_actual INTERVAL,
  rpo_actual INTERVAL,
  success BOOLEAN,
  notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dr_drills_scheduled_at ON dr_drills(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_dr_drills_tier ON dr_drills(tier);
CREATE INDEX IF NOT EXISTS idx_dr_drills_status ON dr_drills(status);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to automatically set retention and expiry
CREATE OR REPLACE FUNCTION set_backup_retention()
RETURNS TRIGGER AS $$
BEGIN
  -- Set retention days based on tier
  NEW.retention_days := CASE NEW.tier
    WHEN 'Basic' THEN 30
    WHEN 'Business' THEN 90
    WHEN 'Enterprise' THEN 365
    ELSE 30
  END;
  
  -- Set expiry date
  NEW.expires_at := NEW.created_at + (NEW.retention_days || ' days')::INTERVAL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_backup_retention
  BEFORE INSERT ON backups
  FOR EACH ROW
  EXECUTE FUNCTION set_backup_retention();

-- Function to mark expired backups
CREATE OR REPLACE FUNCTION mark_expired_backups()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE backups
  SET status = 'expired', deleted_at = NOW()
  WHERE expires_at < NOW()
    AND status = 'completed'
    AND deleted_at IS NULL;
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get backup statistics
CREATE OR REPLACE FUNCTION get_backup_statistics(p_tier VARCHAR DEFAULT NULL)
RETURNS TABLE (
  tier VARCHAR,
  total_backups BIGINT,
  completed_backups BIGINT,
  failed_backups BIGINT,
  total_size NUMERIC,
  last_backup TIMESTAMP WITH TIME ZONE,
  oldest_backup TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.tier,
    COUNT(*) as total_backups,
    COUNT(*) FILTER (WHERE b.status = 'completed') as completed_backups,
    COUNT(*) FILTER (WHERE b.status = 'failed') as failed_backups,
    COALESCE(SUM((b.metadata->>'total_size')::NUMERIC), 0) as total_size,
    MAX(b.created_at) FILTER (WHERE b.status = 'completed') as last_backup,
    MIN(b.created_at) FILTER (WHERE b.status = 'completed') as oldest_backup
  FROM backups b
  WHERE b.deleted_at IS NULL
    AND (p_tier IS NULL OR b.tier = p_tier)
  GROUP BY b.tier;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE backups IS 'Stores backup records with tier-based retention policies';
COMMENT ON TABLE backup_components IS 'Tracks individual components of each backup (PostgreSQL, Redis, file storage)';
COMMENT ON TABLE dr_drills IS 'Records disaster recovery drill executions and results';

COMMENT ON FUNCTION set_backup_retention() IS 'Automatically sets retention period and expiry date based on tenant tier';
COMMENT ON FUNCTION mark_expired_backups() IS 'Marks backups as expired when they exceed their retention period';
COMMENT ON FUNCTION get_backup_statistics(VARCHAR) IS 'Returns backup statistics aggregated by tier';

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- No initial data required

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'backups') THEN
    RAISE EXCEPTION 'Table backups was not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'backup_components') THEN
    RAISE EXCEPTION 'Table backup_components was not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dr_drills') THEN
    RAISE EXCEPTION 'Table dr_drills was not created';
  END IF;
  
  RAISE NOTICE 'Migration 023: Backup System - Completed Successfully';
END $$;
