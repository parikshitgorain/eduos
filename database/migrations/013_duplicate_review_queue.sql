/**
 * Migration 013: Duplicate Review Queue
 * Task 3.2.4: Build duplicate review queue UI
 * 
 * Creates the duplicate_review_queue table for managing flagged duplicate student pairs
 * that require human review and decision-making.
 */

-- Create duplicate_review_queue table
CREATE TABLE IF NOT EXISTS duplicate_review_queue (
  queue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  primary_student_id UUID NOT NULL,
  candidate_student_id UUID NOT NULL,
  
  -- Scoring data
  likelihood_score NUMERIC(5, 4) NOT NULL CHECK (likelihood_score >= 0 AND likelihood_score <= 1),
  deterministic_score NUMERIC(5, 4) NOT NULL CHECK (deterministic_score >= 0 AND deterministic_score <= 1),
  ai_similarity_score NUMERIC(5, 4) CHECK (ai_similarity_score IS NULL OR (ai_similarity_score >= 0 AND ai_similarity_score <= 1)),
  first_name_similarity NUMERIC(5, 4) CHECK (first_name_similarity >= 0 AND first_name_similarity <= 1),
  last_name_similarity NUMERIC(5, 4) CHECK (last_name_similarity >= 0 AND last_name_similarity <= 1),
  dob_match NUMERIC(3, 2) CHECK (dob_match IN (0.0, 1.0)),
  
  -- Explainability data
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  explainability JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Review status and metadata
  status VARCHAR(50) NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'need_more_info')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(255),
  review_notes TEXT,
  
  -- Foreign key constraints
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_primary_student FOREIGN KEY (primary_student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_candidate_student FOREIGN KEY (candidate_student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  
  -- Ensure primary and candidate are different
  CONSTRAINT different_students CHECK (primary_student_id != candidate_student_id),
  
  -- Unique constraint to prevent duplicate pairs (bidirectional)
  CONSTRAINT unique_pair UNIQUE (tenant_id, primary_student_id, candidate_student_id)
);

-- Create indexes for performance
CREATE INDEX idx_drq_tenant_status ON duplicate_review_queue(tenant_id, status);
CREATE INDEX idx_drq_likelihood_score ON duplicate_review_queue(likelihood_score DESC);
CREATE INDEX idx_drq_created_at ON duplicate_review_queue(created_at DESC);
CREATE INDEX idx_drq_primary_student ON duplicate_review_queue(primary_student_id);
CREATE INDEX idx_drq_candidate_student ON duplicate_review_queue(candidate_student_id);

-- Create index for bidirectional pair lookup
CREATE INDEX idx_drq_pair_lookup ON duplicate_review_queue(tenant_id, candidate_student_id, primary_student_id);

-- Add comment to table
COMMENT ON TABLE duplicate_review_queue IS 'Task 3.2.4: Stores flagged duplicate student pairs for human review and decision-making';

-- Add comments to columns
COMMENT ON COLUMN duplicate_review_queue.likelihood_score IS 'Consolidated score: 0.6 × deterministic + 0.4 × AI similarity';
COMMENT ON COLUMN duplicate_review_queue.deterministic_score IS 'Fuzzy matching score: 0.4×first_name + 0.4×last_name + 0.2×DOB';
COMMENT ON COLUMN duplicate_review_queue.ai_similarity_score IS 'SBERT semantic similarity (cosine similarity)';
COMMENT ON COLUMN duplicate_review_queue.reason_codes IS 'Human-readable reasons for flagging as duplicate';
COMMENT ON COLUMN duplicate_review_queue.explainability IS 'Detailed explainability metadata (method, weights, model info)';
COMMENT ON COLUMN duplicate_review_queue.status IS 'Review status: pending_review, approved (merge), rejected (not duplicate), need_more_info';

-- Grant permissions (adjust based on your role setup)
-- GRANT SELECT, INSERT, UPDATE ON duplicate_review_queue TO eduos_app_role;
-- GRANT USAGE, SELECT ON SEQUENCE duplicate_review_queue_queue_id_seq TO eduos_app_role;

-- Enable Row-Level Security (RLS) for multi-tenancy
ALTER TABLE duplicate_review_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only see duplicate pairs for their tenant
CREATE POLICY duplicate_review_queue_tenant_isolation ON duplicate_review_queue
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Create function to prevent duplicate pairs in reverse order
CREATE OR REPLACE FUNCTION prevent_reverse_duplicate_pairs()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the reverse pair already exists
  IF EXISTS (
    SELECT 1 FROM duplicate_review_queue
    WHERE tenant_id = NEW.tenant_id
      AND primary_student_id = NEW.candidate_student_id
      AND candidate_student_id = NEW.primary_student_id
  ) THEN
    RAISE EXCEPTION 'Duplicate pair already exists in reverse order';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent reverse duplicate pairs
CREATE TRIGGER trg_prevent_reverse_duplicate_pairs
  BEFORE INSERT ON duplicate_review_queue
  FOR EACH ROW
  EXECUTE FUNCTION prevent_reverse_duplicate_pairs();

-- Create view for pending reviews (convenience)
CREATE OR REPLACE VIEW pending_duplicate_reviews AS
SELECT 
  drq.queue_id,
  drq.tenant_id,
  drq.primary_student_id,
  drq.candidate_student_id,
  drq.likelihood_score,
  drq.deterministic_score,
  drq.ai_similarity_score,
  drq.reason_codes,
  drq.created_at,
  ps.first_name as primary_first_name,
  ps.last_name as primary_last_name,
  ps.date_of_birth as primary_date_of_birth,
  cs.first_name as candidate_first_name,
  cs.last_name as candidate_last_name,
  cs.date_of_birth as candidate_date_of_birth
FROM duplicate_review_queue drq
JOIN students ps ON drq.primary_student_id = ps.student_id
JOIN students cs ON drq.candidate_student_id = cs.student_id
WHERE drq.status = 'pending_review'
ORDER BY drq.likelihood_score DESC, drq.created_at DESC;

COMMENT ON VIEW pending_duplicate_reviews IS 'Convenience view for pending duplicate reviews sorted by likelihood score';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration 013: Duplicate Review Queue table created successfully';
END $$;
