-- Migration 028: Schedule Proposals Table
-- Task 5.2.2: Implement AI-assisted schedule optimization
-- Stores AI-generated schedule proposals for human review and approval

-- Create schedule_proposals table
CREATE TABLE IF NOT EXISTS schedule_proposals (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  academic_term_id UUID NOT NULL,
  proposal_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Optimization metrics
  fitness_score DECIMAL(5,2) NOT NULL CHECK (fitness_score >= 0 AND fitness_score <= 1),
  hard_constraint_violations INTEGER NOT NULL DEFAULT 0,
  soft_constraint_score INTEGER NOT NULL DEFAULT 0,
  
  -- Proposal data
  summary JSONB NOT NULL,
  assignments JSONB NOT NULL,
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  
  -- Approval tracking
  requested_by UUID NOT NULL,
  published_by UUID,
  published_at TIMESTAMPTZ,
  publish_reason TEXT,
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_schedule_proposals_tenant ON schedule_proposals(tenant_id);
CREATE INDEX idx_schedule_proposals_term ON schedule_proposals(academic_term_id);
CREATE INDEX idx_schedule_proposals_status ON schedule_proposals(status);
CREATE INDEX idx_schedule_proposals_created ON schedule_proposals(created_at DESC);

-- Enable Row-Level Security
ALTER TABLE schedule_proposals ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access proposals from their tenant
CREATE POLICY tenant_isolation_schedule_proposals ON schedule_proposals
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Add proposal_id column to schedule_slots (optional reference)
ALTER TABLE schedule_slots 
  ADD COLUMN IF NOT EXISTS proposal_id VARCHAR(255),
  ADD CONSTRAINT fk_proposal FOREIGN KEY (proposal_id) 
    REFERENCES schedule_proposals(proposal_id) ON DELETE SET NULL;

-- Create index on proposal_id
CREATE INDEX IF NOT EXISTS idx_schedule_slots_proposal ON schedule_slots(proposal_id);

-- Add comment
COMMENT ON TABLE schedule_proposals IS 'AI-generated schedule optimization proposals requiring human approval';
COMMENT ON COLUMN schedule_proposals.fitness_score IS 'Normalized fitness score (0-1) from genetic algorithm';
COMMENT ON COLUMN schedule_proposals.hard_constraint_violations IS 'Number of hard constraint violations (should be 0 for valid proposals)';
COMMENT ON COLUMN schedule_proposals.soft_constraint_score IS 'Soft constraint optimization score';
COMMENT ON COLUMN schedule_proposals.summary IS 'Summary metrics: avg_teacher_gap_minutes, room_utilization_percent, sessions_scheduled, total_conflicts';
COMMENT ON COLUMN schedule_proposals.assignments IS 'Array of schedule assignments with session, time slot, and room details';
COMMENT ON COLUMN schedule_proposals.status IS 'Proposal status: pending (awaiting review), published (approved and active), rejected (not selected)';
COMMENT ON COLUMN schedule_proposals.publish_reason IS 'Admin reason for publishing this proposal';
COMMENT ON COLUMN schedule_proposals.rejection_reason IS 'Admin reason for rejecting this proposal';
