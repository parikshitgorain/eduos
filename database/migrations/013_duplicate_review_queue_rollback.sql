/**
 * Migration 013 Rollback: Duplicate Review Queue
 * Task 3.2.4: Build duplicate review queue UI
 * 
 * Rolls back the duplicate_review_queue table and related objects
 */

-- Drop view
DROP VIEW IF EXISTS pending_duplicate_reviews;

-- Drop trigger
DROP TRIGGER IF EXISTS trg_prevent_reverse_duplicate_pairs ON duplicate_review_queue;

-- Drop function
DROP FUNCTION IF EXISTS prevent_reverse_duplicate_pairs();

-- Drop indexes
DROP INDEX IF EXISTS idx_drq_pair_lookup;
DROP INDEX IF EXISTS idx_drq_candidate_student;
DROP INDEX IF EXISTS idx_drq_primary_student;
DROP INDEX IF EXISTS idx_drq_created_at;
DROP INDEX IF EXISTS idx_drq_likelihood_score;
DROP INDEX IF EXISTS idx_drq_tenant_status;

-- Drop table
DROP TABLE IF EXISTS duplicate_review_queue;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration 013 Rollback: Duplicate Review Queue table dropped successfully';
END $$;
