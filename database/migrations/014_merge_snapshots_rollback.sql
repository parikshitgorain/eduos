-- Rollback Migration 014: Pre-Merge Cryptographic Snapshots
-- Purpose: Safely remove merge snapshot infrastructure

-- ============================================================================
-- 1. DROP HELPER FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS verify_snapshot_integrity(UUID);
DROP FUNCTION IF EXISTS create_merge_snapshot(UUID, UUID, UUID[], UUID);
DROP FUNCTION IF EXISTS compute_snapshot_hash(JSONB, JSONB);

-- ============================================================================
-- 2. DROP TRIGGERS AND TRIGGER FUNCTIONS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_prevent_merge_snapshot_delete ON merge_snapshots;
DROP TRIGGER IF EXISTS trg_prevent_merge_snapshot_update ON merge_snapshots;
DROP FUNCTION IF EXISTS prevent_merge_snapshot_modification();

-- ============================================================================
-- 3. DROP TABLES
-- ============================================================================

DROP TABLE IF EXISTS merge_audit_log CASCADE;
DROP TABLE IF EXISTS merge_snapshots CASCADE;

-- ============================================================================
-- 4. REMOVE MERGE COLUMNS FROM STUDENTS TABLE
-- ============================================================================

DO $$
BEGIN
    -- Drop merged_from column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'merged_from'
    ) THEN
        ALTER TABLE students DROP COLUMN merged_from;
    END IF;
    
    -- Drop merged_at column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'merged_at'
    ) THEN
        ALTER TABLE students DROP COLUMN merged_at;
    END IF;
    
    -- Drop merged_into column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'merged_into'
    ) THEN
        ALTER TABLE students DROP COLUMN merged_into;
    END IF;
    
    -- Restore original status constraint
    ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
    ALTER TABLE students ADD CONSTRAINT students_status_check 
        CHECK (status IN ('active', 'inactive', 'graduated', 'transferred'));
END $$;

-- Drop merge-related index
DROP INDEX IF EXISTS idx_students_merged_into;
