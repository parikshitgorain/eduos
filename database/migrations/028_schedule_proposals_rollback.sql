-- Rollback Migration 028: Schedule Proposals Table
-- Removes schedule proposals functionality

-- Drop foreign key constraint from schedule_slots
ALTER TABLE schedule_slots 
  DROP CONSTRAINT IF EXISTS fk_proposal;

-- Drop proposal_id column from schedule_slots
ALTER TABLE schedule_slots 
  DROP COLUMN IF EXISTS proposal_id;

-- Drop indexes
DROP INDEX IF EXISTS idx_schedule_slots_proposal;
DROP INDEX IF EXISTS idx_schedule_proposals_created;
DROP INDEX IF EXISTS idx_schedule_proposals_status;
DROP INDEX IF EXISTS idx_schedule_proposals_term;
DROP INDEX IF EXISTS idx_schedule_proposals_tenant;

-- Drop RLS policy
DROP POLICY IF EXISTS tenant_isolation_schedule_proposals ON schedule_proposals;

-- Disable RLS
ALTER TABLE schedule_proposals DISABLE ROW LEVEL SECURITY;

-- Drop table
DROP TABLE IF EXISTS schedule_proposals;
