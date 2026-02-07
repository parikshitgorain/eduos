-- ============================================================================
-- Migration 017: Invoice Generation System
-- ============================================================================
-- Description: Creates tables and functions for invoice generation with sequential numbering
-- Author: EduOS Team
-- Date: 2026-02-07
-- Dependencies: 016_payment_gateway.sql
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
-- Stores invoices with sequential numbering per tenant
-- Format: INV-{YYYY}-{MM}-{NNNN} (e.g., INV-2026-02-0001)
-- Sequential numbering ensures no gaps per tenant

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  
  -- Invoice Number (Sequential per tenant per month)
  invoice_number VARCHAR(50) NOT NULL, -- Format: INV-{YYYY}-{MM}-{NNNN}
  invoice_year INTEGER NOT NULL,
  invoice_month INTEGER NOT NULL CHECK (invoice_month BETWEEN 1 AND 12),
  invoice_sequence INTEGER NOT NULL CHECK (invoice_sequence > 0),
  
  -- Invoice Details
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'cancelled', 'refunded')),
  
  -- Financial Information
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0), -- Amount in paise
  tax_amount INTEGER NOT NULL DEFAULT 0 CHECK (tax_amount >= 0), -- Tax in paise
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0), -- Discount in paise
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0), -- Total in paise
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  
  -- Line Items (stored as JSONB array)
  line_items JSONB NOT NULL DEFAULT '[]',
  -- Format: [{"description": "Tuition Fee", "quantity": 1, "unit_price": 50000, "amount": 50000}]
  
  -- Tax Details (stored as JSONB)
  tax_details JSONB DEFAULT '{}',
  -- Format: {"cgst": 9, "sgst": 9, "igst": 0, "total_tax_rate": 18}
  
  -- Discount Details
  discount_details JSONB DEFAULT '{}',
  -- Format: {"type": "percentage", "value": 10, "reason": "Early bird discount"}
  
  -- Notes and Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- PDF Generation
  pdf_url TEXT, -- S3 URL for generated PDF
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one invoice number per tenant
  UNIQUE (tenant_id, invoice_number),
  -- Unique constraint: sequential numbering per tenant per month
  UNIQUE (tenant_id, invoice_year, invoice_month, invoice_sequence)
);

-- Create indexes for performance
CREATE INDEX idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX idx_invoices_student_id ON invoices(student_id);
CREATE INDEX idx_invoices_payment_id ON invoices(payment_id);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);
CREATE INDEX idx_invoices_sequence ON invoices(tenant_id, invoice_year, invoice_month, invoice_sequence);

-- Enable Row-Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access invoices from their tenant
CREATE POLICY invoices_tenant_isolation ON invoices
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON invoices TO eduos_app;

-- ============================================================================
-- INVOICE_SEQUENCES TABLE
-- ============================================================================
-- Tracks the next sequence number for each tenant per month
-- Ensures no gaps in sequential numbering

CREATE TABLE IF NOT EXISTS invoice_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_year INTEGER NOT NULL,
  invoice_month INTEGER NOT NULL CHECK (invoice_month BETWEEN 1 AND 12),
  next_sequence INTEGER NOT NULL DEFAULT 1 CHECK (next_sequence > 0),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one sequence tracker per tenant per month
  UNIQUE (tenant_id, invoice_year, invoice_month)
);

-- Create indexes for performance
CREATE INDEX idx_invoice_sequences_tenant_id ON invoice_sequences(tenant_id);
CREATE INDEX idx_invoice_sequences_year_month ON invoice_sequences(tenant_id, invoice_year, invoice_month);

-- Enable Row-Level Security
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access sequences from their tenant
CREATE POLICY invoice_sequences_tenant_isolation ON invoice_sequences
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON invoice_sequences TO eduos_app;

-- ============================================================================
-- FUNCTION: Generate Next Invoice Number
-- ============================================================================
-- Generates the next sequential invoice number for a tenant
-- Format: INV-{YYYY}-{MM}-{NNNN}
-- Thread-safe using SELECT FOR UPDATE

CREATE OR REPLACE FUNCTION generate_invoice_number(
  p_tenant_id UUID,
  p_year INTEGER DEFAULT NULL,
  p_month INTEGER DEFAULT NULL
)
RETURNS TABLE (
  invoice_number VARCHAR(50),
  invoice_year INTEGER,
  invoice_month INTEGER,
  invoice_sequence INTEGER
) AS $
DECLARE
  v_year INTEGER;
  v_month INTEGER;
  v_sequence INTEGER;
  v_invoice_number VARCHAR(50);
BEGIN
  -- Use current year/month if not provided
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  v_month := COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER);
  
  -- Lock the sequence row for this tenant/year/month (or create if doesn't exist)
  INSERT INTO invoice_sequences (tenant_id, invoice_year, invoice_month, next_sequence)
  VALUES (p_tenant_id, v_year, v_month, 1)
  ON CONFLICT (tenant_id, invoice_year, invoice_month) 
  DO NOTHING;
  
  -- Get and increment the sequence number (thread-safe)
  UPDATE invoice_sequences
  SET next_sequence = next_sequence + 1,
      updated_at = NOW()
  WHERE invoice_sequences.tenant_id = p_tenant_id
    AND invoice_sequences.invoice_year = v_year
    AND invoice_sequences.invoice_month = v_month
  RETURNING next_sequence - 1 INTO v_sequence;
  
  -- Generate invoice number: INV-{YYYY}-{MM}-{NNNN}
  v_invoice_number := FORMAT('INV-%s-%s-%s', 
    v_year,
    LPAD(v_month::TEXT, 2, '0'),
    LPAD(v_sequence::TEXT, 4, '0')
  );
  
  -- Return the generated invoice number
  RETURN QUERY SELECT v_invoice_number, v_year, v_month, v_sequence;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Detect Invoice Sequence Gaps
-- ============================================================================
-- Detects gaps in invoice sequence numbering for a tenant
-- Returns list of missing sequence numbers

CREATE OR REPLACE FUNCTION detect_invoice_gaps(
  p_tenant_id UUID,
  p_year INTEGER DEFAULT NULL,
  p_month INTEGER DEFAULT NULL
)
RETURNS TABLE (
  year INTEGER,
  month INTEGER,
  missing_sequence INTEGER
) AS $
DECLARE
  v_year INTEGER;
  v_month INTEGER;
BEGIN
  -- Use current year/month if not provided
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  v_month := COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER);
  
  -- Find gaps in sequence
  RETURN QUERY
  WITH sequence_range AS (
    SELECT generate_series(1, (
      SELECT COALESCE(MAX(invoice_sequence), 0)
      FROM invoices
      WHERE tenant_id = p_tenant_id
        AND invoice_year = v_year
        AND invoice_month = v_month
    )) AS seq
  )
  SELECT 
    v_year,
    v_month,
    sr.seq
  FROM sequence_range sr
  WHERE NOT EXISTS (
    SELECT 1 
    FROM invoices i
    WHERE i.tenant_id = p_tenant_id
      AND i.invoice_year = v_year
      AND i.invoice_month = v_month
      AND i.invoice_sequence = sr.seq
  );
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
-- Automatically update updated_at timestamp

CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_updated_at_trigger
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();

CREATE TRIGGER invoice_sequences_updated_at_trigger
  BEFORE UPDATE ON invoice_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE invoices IS 'Invoices with sequential numbering per tenant';
COMMENT ON COLUMN invoices.invoice_number IS 'Format: INV-{YYYY}-{MM}-{NNNN}';
COMMENT ON COLUMN invoices.line_items IS 'Array of line items with description, quantity, unit_price, amount';
COMMENT ON COLUMN invoices.tax_details IS 'Tax breakdown (CGST, SGST, IGST for India)';
COMMENT ON COLUMN invoices.discount_details IS 'Discount type, value, and reason';
COMMENT ON COLUMN invoices.subtotal IS 'Amount before tax and discount (in paise)';
COMMENT ON COLUMN invoices.total_amount IS 'Final amount after tax and discount (in paise)';

COMMENT ON TABLE invoice_sequences IS 'Tracks next sequence number per tenant per month';
COMMENT ON FUNCTION generate_invoice_number IS 'Thread-safe invoice number generation';
COMMENT ON FUNCTION detect_invoice_gaps IS 'Detects gaps in invoice sequence numbering';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $
BEGIN
  -- Verify tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    RAISE EXCEPTION 'Migration failed: invoices table not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_sequences') THEN
    RAISE EXCEPTION 'Migration failed: invoice_sequences table not created';
  END IF;

  -- Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'invoices' AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Migration failed: RLS not enabled on invoices table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'invoice_sequences' AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Migration failed: RLS not enabled on invoice_sequences table';
  END IF;

  -- Verify functions exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'generate_invoice_number'
  ) THEN
    RAISE EXCEPTION 'Migration failed: generate_invoice_number function not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'detect_invoice_gaps'
  ) THEN
    RAISE EXCEPTION 'Migration failed: detect_invoice_gaps function not created';
  END IF;

  RAISE NOTICE 'Migration 017 completed successfully';
  RAISE NOTICE '✓ invoices table created with RLS';
  RAISE NOTICE '✓ invoice_sequences table created with RLS';
  RAISE NOTICE '✓ generate_invoice_number function created';
  RAISE NOTICE '✓ detect_invoice_gaps function created';
  RAISE NOTICE '✓ Indexes created for performance';
  RAISE NOTICE '✓ Sequential numbering constraints in place';
END $;
