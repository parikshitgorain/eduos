-- Migration 012: Offline-First Attendance System
-- Creates tables for attendance tracking with offline sync support

-- ============================================================================
-- ATTENDANCE RECORDS TABLE
-- ============================================================================
-- Stores attendance records synced from mobile devices
-- Implements idempotent sync with conflict resolution

CREATE TABLE IF NOT EXISTS attendance_records (
  -- Primary identifiers
  event_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  
  -- Attendance details
  student_id UUID NOT NULL,
  session_id UUID NOT NULL,
  batch_id UUID,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  
  -- Tracking information
  marked_by UUID NOT NULL, -- Teacher/user who marked attendance
  marked_at_utc TIMESTAMP NOT NULL, -- Normalized UTC timestamp
  client_local_time TEXT NOT NULL, -- Original client timestamp with timezone
  device_id TEXT NOT NULL, -- Device identifier
  
  -- Location data (optional)
  location JSONB, -- {latitude, longitude, accuracy_meters}
  
  -- Sync metadata
  sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  conflict_resolved BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_attendance_tenant ON attendance_records(tenant_id);
CREATE INDEX idx_attendance_student ON attendance_records(student_id);
CREATE INDEX idx_attendance_session ON attendance_records(session_id);
CREATE INDEX idx_attendance_batch ON attendance_records(batch_id);
CREATE INDEX idx_attendance_marked_at ON attendance_records(marked_at_utc);
CREATE INDEX idx_attendance_sync_status ON attendance_records(sync_status);

-- Composite index for conflict detection
CREATE INDEX idx_attendance_conflict_check ON attendance_records(student_id, session_id, tenant_id);

-- Enable Row-Level Security (RLS)
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access attendance records for their tenant
CREATE POLICY attendance_tenant_isolation ON attendance_records
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- ============================================================================
-- SYNC CONFLICTS TABLE
-- ============================================================================
-- Logs conflicts detected during sync for admin review

CREATE TABLE IF NOT EXISTS sync_conflicts (
  -- Primary identifiers
  conflict_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  
  -- Conflict details
  session_id UUID NOT NULL,
  student_id UUID NOT NULL,
  winning_event_id UUID NOT NULL,
  rejected_event_id UUID NOT NULL,
  resolution_rule VARCHAR(50) NOT NULL, -- e.g., 'earliest_client_timestamp'
  
  -- Conflict metadata
  conflict_details JSONB, -- Full conflict resolution details
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conflicts_tenant ON sync_conflicts(tenant_id);
CREATE INDEX idx_conflicts_session ON sync_conflicts(session_id);
CREATE INDEX idx_conflicts_student ON sync_conflicts(student_id);
CREATE INDEX idx_conflicts_created ON sync_conflicts(created_at DESC);

-- Enable Row-Level Security (RLS)
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access conflicts for their tenant
CREATE POLICY conflicts_tenant_isolation ON sync_conflicts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- ============================================================================
-- SESSIONS TABLE (Reference)
-- ============================================================================
-- Stores session/class information for attendance tracking
-- This is a simplified version - full implementation would be more complex

CREATE TABLE IF NOT EXISTS sessions (
  -- Primary identifiers
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Session details
  batch_id UUID NOT NULL,
  session_name VARCHAR(255) NOT NULL,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  -- Session metadata
  location VARCHAR(255),
  instructor_id UUID,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX idx_sessions_batch ON sessions(batch_id);
CREATE INDEX idx_sessions_date ON sessions(session_date);
CREATE INDEX idx_sessions_status ON sessions(status);

-- Enable Row-Level Security (RLS)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access sessions for their tenant
CREATE POLICY sessions_tenant_isolation ON sessions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for attendance_records
CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for sessions
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE attendance_records IS 'Stores attendance records synced from mobile devices with offline support';
COMMENT ON COLUMN attendance_records.event_id IS 'Globally unique event identifier (UUID v4)';
COMMENT ON COLUMN attendance_records.marked_at_utc IS 'Normalized UTC timestamp for consistent sorting';
COMMENT ON COLUMN attendance_records.client_local_time IS 'Original client timestamp preserved for audit';
COMMENT ON COLUMN attendance_records.conflict_resolved IS 'True if this record was involved in conflict resolution';

COMMENT ON TABLE sync_conflicts IS 'Logs conflicts detected during attendance sync for admin review';
COMMENT ON COLUMN sync_conflicts.resolution_rule IS 'Rule used to resolve conflict (e.g., earliest_client_timestamp)';
COMMENT ON COLUMN sync_conflicts.conflict_details IS 'Full JSON details of conflict resolution';

COMMENT ON TABLE sessions IS 'Stores session/class information for attendance tracking';
