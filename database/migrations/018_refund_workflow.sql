-- ============================================================================
-- Migration 018: Refund Workflow with Approval Chain
-- ============================================================================
-- Description: Creates tables for refund requests with approval chain workflow
-- Author: EduOS Team
-- Date: 2026-02-07
-- Dependencies: 016_payment_gateway.sql, 017_invoice_generation.sql
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- REFUND_REQUESTS TABLE
-- ============================================================================
-- Stores refund requests with approval chain workflow
-- Approval chain: Teacher → Admin → Finance Manager
-- Supports partial refunds

CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Payment/Invoice Reference
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- Refund Details
  refund_amount INTEGER NOT NULL CHECK (refund_amount > 0), -- Amount in smallest currency unit (paise for INR)
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  refund_type VARCHAR(20) NOT NULL CHECK (refund_type IN ('full', 'partial')),
  reason TEXT NOT NULL,
  
  -- Supporting Documents
  supporting_documents JSONB DEFAULT '[]', -- Array of document URLs/references
  
  -- Status Tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed', 'cancelled')),
  
  -- Approval Chain
  requested_by UUID NOT NULL, -- User who requested the refund
  teacher_approved_by UUID,
  teacher_approved_at TIMESTAMP WITH TIME ZONE,
  teacher_rejection_reason TEXT,
  
  admin_approved_by UUID,
  admin_approved_at TIMESTAMP WITH TIME ZONE,
  admin_rejection_reason TEXT,
  
  finance_approved_by UUID,
  finance_approved_at TIMESTAMP WITH TIME ZONE,
  finance_rejection_reason TEXT,
  
  -- Processing Details
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  gateway_refund_id VARCHAR(255), -- Gateway refund transaction ID
  gateway_status VARCHAR(50), -- Gateway refund status
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CHECK (
    (payment_id IS NOT NULL AND invoice_id IS NULL) OR
    (payment_id IS NULL AND invoice_id IS NOT NULL) OR
    (payment_id IS NOT NULL AND invoice_id IS NOT NULL)
  )
);

-- Create indexes for performance
CREATE INDEX idx_refund_requests_tenant_id ON refund_requests(tenant_id);
CREATE INDEX idx_refund_requests_payment_id ON refund_requests(payment_id);
CREATE INDEX idx_refund_requests_invoice_id ON refund_requests(invoice_id);
CREATE INDEX idx_refund_requests_status ON refund_requests(status);
CREATE INDEX idx_refund_requests_requested_by ON refund_requests(requested_by);
CREATE INDEX idx_refund_requests_created_at ON refund_requests(created_at);

-- Enable Row-Level Security
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access refund requests from their tenant
CREATE POLICY refund_requests_tenant_isolation ON refund_requests
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON refund_requests TO eduos_app;

-- ============================================================================
-- REFUND_APPROVAL_HISTORY TABLE
-- ============================================================================
-- Stores complete audit trail of approval chain actions

CREATE TABLE IF NOT EXISTS refund_approval_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  refund_request_id UUID NOT NULL REFERENCES refund_requests(id) ON DELETE CASCADE,
  
  -- Approval Details
  approver_role VARCHAR(50) NOT NULL CHECK (approver_role IN ('teacher', 'admin', 'finance_manager')),
  approver_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('approved', 'rejected', 'requested_info')),
  comments TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_refund_approval_history_tenant_id ON refund_approval_history(tenant_id);
CREATE INDEX idx_refund_approval_history_refund_request_id ON refund_approval_history(refund_request_id);
CREATE INDEX idx_refund_approval_history_approver_id ON refund_approval_history(approver_id);
CREATE INDEX idx_refund_approval_history_created_at ON refund_approval_history(created_at);

-- Enable Row-Level Security
ALTER TABLE refund_approval_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access approval history from their tenant
CREATE POLICY refund_approval_history_tenant_isolation ON refund_approval_history
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Grant permissions
GRANT SELECT, INSERT ON refund_approval_history TO eduos_app;

-- ============================================================================
-- CREDIT_NOTES TABLE
-- ============================================================================
-- Stores credit notes generated for approved refunds
-- Linked to original invoices

CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- References
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  refund_request_id UUID NOT NULL REFERENCES refund_requests(id) ON DELETE CASCADE,
  
  -- Credit Note Number (follows invoice numbering pattern)
  credit_note_number VARCHAR(50) NOT NULL,
  credit_note_year INTEGER NOT NULL,
  credit_note_month INTEGER NOT NULL,
  credit_note_sequence INTEGER NOT NULL,
  
  -- Credit Note Details
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  credit_amount INTEGER NOT NULL CHECK (credit_amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  reason TEXT NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'applied', 'cancelled')),
  
  -- PDF Generation
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one credit note number per tenant
  UNIQUE (tenant_id, credit_note_number)
);

-- Create indexes for performance
CREATE INDEX idx_credit_notes_tenant_id ON credit_notes(tenant_id);
CREATE INDEX idx_credit_notes_invoice_id ON credit_notes(invoice_id);
CREATE INDEX idx_credit_notes_refund_request_id ON credit_notes(refund_request_id);
CREATE INDEX idx_credit_notes_status ON credit_notes(status);
CREATE INDEX idx_credit_notes_created_at ON credit_notes(created_at);

-- Enable Row-Level Security
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access credit notes from their tenant
CREATE POLICY credit_notes_tenant_isolation ON credit_notes
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON credit_notes TO eduos_app;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to generate credit note number
CREATE OR REPLACE FUNCTION generate_credit_note_number(p_tenant_id UUID)
RETURNS TABLE (
  credit_note_number VARCHAR(50),
  credit_note_year INTEGER,
  credit_note_month INTEGER,
  credit_note_sequence INTEGER
) AS $
DECLARE
  v_year INTEGER;
  v_month INTEGER;
  v_sequence INTEGER;
  v_credit_note_number VARCHAR(50);
BEGIN
  -- Get current year and month
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_month := EXTRACT(MONTH FROM CURRENT_DATE);
  
  -- Get next sequence number for this tenant, year, and month
  SELECT COALESCE(MAX(credit_note_sequence), 0) + 1
  INTO v_sequence
  FROM credit_notes
  WHERE tenant_id = p_tenant_id
    AND credit_note_year = v_year
    AND credit_note_month = v_month;
  
  -- Format: CN-YYYY-MM-NNNN (e.g., CN-2026-02-0001)
  v_credit_note_number := 'CN-' || 
                          LPAD(v_year::TEXT, 4, '0') || '-' || 
                          LPAD(v_month::TEXT, 2, '0') || '-' || 
                          LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN QUERY SELECT v_credit_note_number, v_year, v_month, v_sequence;
END;
$ LANGUAGE plpgsql;

-- Function to check if refund amount is valid
CREATE OR REPLACE FUNCTION validate_refund_amount()
RETURNS TRIGGER AS $
DECLARE
  v_payment_amount INTEGER;
  v_invoice_amount INTEGER;
  v_total_refunded INTEGER;
  v_max_refundable INTEGER;
BEGIN
  -- Get payment amount if payment_id is provided
  IF NEW.payment_id IS NOT NULL THEN
    SELECT amount INTO v_payment_amount
    FROM payments
    WHERE id = NEW.payment_id AND tenant_id = NEW.tenant_id;
    
    IF v_payment_amount IS NULL THEN
      RAISE EXCEPTION 'Payment not found';
    END IF;
  END IF;
  
  -- Get invoice amount if invoice_id is provided
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT total_amount INTO v_invoice_amount
    FROM invoices
    WHERE id = NEW.invoice_id AND tenant_id = NEW.tenant_id;
    
    IF v_invoice_amount IS NULL THEN
      RAISE EXCEPTION 'Invoice not found';
    END IF;
  END IF;
  
  -- Calculate total already refunded
  SELECT COALESCE(SUM(refund_amount), 0) INTO v_total_refunded
  FROM refund_requests
  WHERE tenant_id = NEW.tenant_id
    AND status IN ('approved', 'processed')
    AND (
      (NEW.payment_id IS NOT NULL AND payment_id = NEW.payment_id) OR
      (NEW.invoice_id IS NOT NULL AND invoice_id = NEW.invoice_id)
    )
    AND id != NEW.id; -- Exclude current request for updates
  
  -- Determine max refundable amount
  v_max_refundable := COALESCE(v_payment_amount, v_invoice_amount, 0) - v_total_refunded;
  
  -- Validate refund amount
  IF NEW.refund_amount > v_max_refundable THEN
    RAISE EXCEPTION 'Refund amount (%) exceeds maximum refundable amount (%)', 
      NEW.refund_amount, v_max_refundable;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger to validate refund amount
CREATE TRIGGER validate_refund_amount_trigger
  BEFORE INSERT OR UPDATE ON refund_requests
  FOR EACH ROW
  EXECUTE FUNCTION validate_refund_amount();

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_refund_requests_updated_at()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER refund_requests_updated_at_trigger
  BEFORE UPDATE ON refund_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_refund_requests_updated_at();

CREATE OR REPLACE FUNCTION update_credit_notes_updated_at()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER credit_notes_updated_at_trigger
  BEFORE UPDATE ON credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_notes_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE refund_requests IS 'Refund requests with approval chain workflow (Teacher → Admin → Finance Manager)';
COMMENT ON COLUMN refund_requests.refund_amount IS 'Amount in smallest currency unit (paise for INR)';
COMMENT ON COLUMN refund_requests.refund_type IS 'full or partial refund';
COMMENT ON COLUMN refund_requests.supporting_documents IS 'Array of document URLs/references';
COMMENT ON COLUMN refund_requests.status IS 'pending, approved, rejected, processed, cancelled';

COMMENT ON TABLE refund_approval_history IS 'Complete audit trail of approval chain actions';
COMMENT ON COLUMN refund_approval_history.approver_role IS 'teacher, admin, or finance_manager';
COMMENT ON COLUMN refund_approval_history.action IS 'approved, rejected, or requested_info';

COMMENT ON TABLE credit_notes IS 'Credit notes generated for approved refunds';
COMMENT ON COLUMN credit_notes.credit_note_number IS 'Format: CN-YYYY-MM-NNNN (e.g., CN-2026-02-0001)';
COMMENT ON COLUMN credit_notes.credit_amount IS 'Amount in smallest currency unit (paise for INR)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $
BEGIN
  -- Verify tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refund_requests') THEN
    RAISE EXCEPTION 'Migration failed: refund_requests table not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refund_approval_history') THEN
    RAISE EXCEPTION 'Migration failed: refund_approval_history table not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_notes') THEN
    RAISE EXCEPTION 'Migration failed: credit_notes table not created';
  END IF;

  -- Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'refund_requests' AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Migration failed: RLS not enabled on refund_requests table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'refund_approval_history' AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Migration failed: RLS not enabled on refund_approval_history table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'credit_notes' AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Migration failed: RLS not enabled on credit_notes table';
  END IF;

  RAISE NOTICE 'Migration 018 completed successfully';
  RAISE NOTICE '✓ refund_requests table created with RLS';
  RAISE NOTICE '✓ refund_approval_history table created with RLS';
  RAISE NOTICE '✓ credit_notes table created with RLS';
  RAISE NOTICE '✓ Indexes created for performance';
  RAISE NOTICE '✓ Approval chain workflow implemented';
  RAISE NOTICE '✓ Refund amount validation in place';
END $;
