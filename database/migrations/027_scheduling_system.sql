-- ============================================================================
-- Migration: 027_scheduling_system.sql
-- Description: Create scheduling system with conflict detection
-- Version: 1.0
-- ============================================================================

-- ============================================================================
-- 1. ROOMS TABLE
-- ============================================================================
-- Stores physical rooms/locations where classes can be held

CREATE TABLE IF NOT EXISTS rooms (
    room_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    room_name VARCHAR(255) NOT NULL,
    room_code VARCHAR(50) NOT NULL,
    building VARCHAR(255),
    floor VARCHAR(50),
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    room_type VARCHAR(50) NOT NULL, -- 'classroom', 'lab', 'auditorium', 'sports', 'library'
    facilities JSONB DEFAULT '[]'::jsonb, -- ['projector', 'whiteboard', 'computers', 'ac']
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    CONSTRAINT unique_room_code_per_tenant UNIQUE (tenant_id, room_code)
);

-- Index for tenant-based queries
CREATE INDEX idx_rooms_tenant_id ON rooms(tenant_id);
CREATE INDEX idx_rooms_active ON rooms(tenant_id, is_active);

-- ============================================================================
-- 2. TEACHERS TABLE (Simplified - may reference existing users table)
-- ============================================================================
-- Stores teacher information for scheduling

CREATE TABLE IF NOT EXISTS teachers (
    teacher_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID, -- Reference to users table if exists
    teacher_code VARCHAR(50) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    department VARCHAR(255),
    specialization VARCHAR(255),
    max_hours_per_week INTEGER DEFAULT 40,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_teacher_code_per_tenant UNIQUE (tenant_id, teacher_code)
);

-- Index for tenant-based queries
CREATE INDEX idx_teachers_tenant_id ON teachers(tenant_id);
CREATE INDEX idx_teachers_active ON teachers(tenant_id, is_active);

-- ============================================================================
-- 3. SUBJECTS TABLE
-- ============================================================================
-- Stores subjects/courses that can be scheduled

CREATE TABLE IF NOT EXISTS subjects (
    subject_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subject_code VARCHAR(50) NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    description TEXT,
    credits INTEGER,
    hours_per_week INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_subject_code_per_tenant UNIQUE (tenant_id, subject_code)
);

-- Index for tenant-based queries
CREATE INDEX idx_subjects_tenant_id ON subjects(tenant_id);
CREATE INDEX idx_subjects_active ON subjects(tenant_id, is_active);

-- ============================================================================
-- 4. BATCHES TABLE (Reference to existing hierarchy)
-- ============================================================================
-- Note: This may already exist in the hierarchy system
-- If it exists, we'll reference it. If not, we create a simplified version.

CREATE TABLE IF NOT EXISTS batches (
    batch_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    batch_code VARCHAR(50) NOT NULL,
    batch_name VARCHAR(255) NOT NULL,
    program_id UUID, -- Reference to program in hierarchy
    academic_year VARCHAR(20),
    semester VARCHAR(20),
    student_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_batch_code_per_tenant UNIQUE (tenant_id, batch_code)
);

-- Index for tenant-based queries
CREATE INDEX idx_batches_tenant_id ON batches(tenant_id);
CREATE INDEX idx_batches_active ON batches(tenant_id, is_active);

-- ============================================================================
-- 5. SCHEDULE_SLOTS TABLE
-- ============================================================================
-- Stores individual schedule assignments

CREATE TABLE IF NOT EXISTS schedule_slots (
    slot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Resource references
    room_id UUID NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
    
    -- Time information
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Date range for validity
    effective_from DATE NOT NULL,
    effective_to DATE,
    
    -- Recurrence pattern
    is_recurring BOOLEAN DEFAULT true,
    recurrence_pattern VARCHAR(50) DEFAULT 'weekly', -- 'weekly', 'biweekly', 'monthly', 'one-time'
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'cancelled', 'completed', 'draft'
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    -- Constraints
    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    CONSTRAINT valid_date_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Indexes for conflict detection queries
CREATE INDEX idx_schedule_slots_tenant_id ON schedule_slots(tenant_id);
CREATE INDEX idx_schedule_slots_room ON schedule_slots(tenant_id, room_id, day_of_week, start_time, end_time);
CREATE INDEX idx_schedule_slots_teacher ON schedule_slots(tenant_id, teacher_id, day_of_week, start_time, end_time);
CREATE INDEX idx_schedule_slots_batch ON schedule_slots(tenant_id, batch_id, day_of_week, start_time, end_time);
CREATE INDEX idx_schedule_slots_date_range ON schedule_slots(tenant_id, effective_from, effective_to);
CREATE INDEX idx_schedule_slots_status ON schedule_slots(tenant_id, status);

-- ============================================================================
-- 6. SCHEDULE_OVERRIDES TABLE
-- ============================================================================
-- Stores temporary schedule changes (substitute teacher, room change, etc.)

CREATE TABLE IF NOT EXISTS schedule_overrides (
    override_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES schedule_slots(slot_id) ON DELETE CASCADE,
    
    -- Override details
    override_type VARCHAR(50) NOT NULL, -- 'substitute_teacher', 'room_change', 'time_shift', 'cancellation'
    override_date DATE NOT NULL,
    
    -- New values (nullable - only set if changed)
    new_room_id UUID REFERENCES rooms(room_id),
    new_teacher_id UUID REFERENCES teachers(teacher_id),
    new_start_time TIME,
    new_end_time TIME,
    
    -- Reason and approval
    reason TEXT NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'applied'
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    
    CONSTRAINT valid_override_time CHECK (new_end_time IS NULL OR new_start_time IS NULL OR new_end_time > new_start_time)
);

-- Indexes for override queries
CREATE INDEX idx_schedule_overrides_tenant_id ON schedule_overrides(tenant_id);
CREATE INDEX idx_schedule_overrides_slot_id ON schedule_overrides(slot_id);
CREATE INDEX idx_schedule_overrides_date ON schedule_overrides(tenant_id, override_date);
CREATE INDEX idx_schedule_overrides_status ON schedule_overrides(tenant_id, status);

-- ============================================================================
-- 7. SCHEDULE_CONFLICTS TABLE
-- ============================================================================
-- Logs detected conflicts for audit and resolution

CREATE TABLE IF NOT EXISTS schedule_conflicts (
    conflict_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Conflict details
    conflict_type VARCHAR(50) NOT NULL, -- 'room_double_booking', 'teacher_double_booking', 'batch_double_booking', 'time_overlap'
    severity VARCHAR(20) DEFAULT 'high', -- 'low', 'medium', 'high', 'critical'
    
    -- Conflicting slots
    slot_id_1 UUID NOT NULL REFERENCES schedule_slots(slot_id) ON DELETE CASCADE,
    slot_id_2 UUID REFERENCES schedule_slots(slot_id) ON DELETE CASCADE,
    
    -- Conflict description
    description TEXT NOT NULL,
    conflict_details JSONB DEFAULT '{}'::jsonb,
    
    -- Resolution
    status VARCHAR(50) DEFAULT 'unresolved', -- 'unresolved', 'acknowledged', 'resolved', 'ignored'
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    -- Metadata
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for conflict queries
CREATE INDEX idx_schedule_conflicts_tenant_id ON schedule_conflicts(tenant_id);
CREATE INDEX idx_schedule_conflicts_status ON schedule_conflicts(tenant_id, status);
CREATE INDEX idx_schedule_conflicts_type ON schedule_conflicts(tenant_id, conflict_type);
CREATE INDEX idx_schedule_conflicts_slots ON schedule_conflicts(slot_id_1, slot_id_2);

-- ============================================================================
-- 8. CONFLICT DETECTION FUNCTION
-- ============================================================================
-- Function to detect scheduling conflicts

CREATE OR REPLACE FUNCTION detect_schedule_conflicts(
    p_tenant_id UUID,
    p_room_id UUID,
    p_teacher_id UUID,
    p_batch_id UUID,
    p_day_of_week INTEGER,
    p_start_time TIME,
    p_end_time TIME,
    p_effective_from DATE,
    p_effective_to DATE,
    p_exclude_slot_id UUID DEFAULT NULL
)
RETURNS TABLE (
    conflict_type VARCHAR,
    conflicting_slot_id UUID,
    conflict_description TEXT
) AS $$
BEGIN
    -- Check for room conflicts
    RETURN QUERY
    SELECT 
        'room_double_booking'::VARCHAR as conflict_type,
        s.slot_id as conflicting_slot_id,
        format('Room %s is already booked on %s from %s to %s', 
               r.room_name, 
               CASE p_day_of_week 
                   WHEN 0 THEN 'Sunday'
                   WHEN 1 THEN 'Monday'
                   WHEN 2 THEN 'Tuesday'
                   WHEN 3 THEN 'Wednesday'
                   WHEN 4 THEN 'Thursday'
                   WHEN 5 THEN 'Friday'
                   WHEN 6 THEN 'Saturday'
               END,
               s.start_time::TEXT,
               s.end_time::TEXT
        ) as conflict_description
    FROM schedule_slots s
    JOIN rooms r ON s.room_id = r.room_id
    WHERE s.tenant_id = p_tenant_id
        AND s.room_id = p_room_id
        AND s.day_of_week = p_day_of_week
        AND s.status = 'active'
        AND (p_exclude_slot_id IS NULL OR s.slot_id != p_exclude_slot_id)
        -- Time overlap check
        AND (
            (p_start_time >= s.start_time AND p_start_time < s.end_time) OR
            (p_end_time > s.start_time AND p_end_time <= s.end_time) OR
            (p_start_time <= s.start_time AND p_end_time >= s.end_time)
        )
        -- Date range overlap check
        AND (
            (s.effective_to IS NULL OR s.effective_to >= p_effective_from) AND
            (p_effective_to IS NULL OR p_effective_to >= s.effective_from)
        );
    
    -- Check for teacher conflicts
    RETURN QUERY
    SELECT 
        'teacher_double_booking'::VARCHAR as conflict_type,
        s.slot_id as conflicting_slot_id,
        format('Teacher %s %s is already assigned on %s from %s to %s', 
               t.first_name,
               t.last_name,
               CASE p_day_of_week 
                   WHEN 0 THEN 'Sunday'
                   WHEN 1 THEN 'Monday'
                   WHEN 2 THEN 'Tuesday'
                   WHEN 3 THEN 'Wednesday'
                   WHEN 4 THEN 'Thursday'
                   WHEN 5 THEN 'Friday'
                   WHEN 6 THEN 'Saturday'
               END,
               s.start_time::TEXT,
               s.end_time::TEXT
        ) as conflict_description
    FROM schedule_slots s
    JOIN teachers t ON s.teacher_id = t.teacher_id
    WHERE s.tenant_id = p_tenant_id
        AND s.teacher_id = p_teacher_id
        AND s.day_of_week = p_day_of_week
        AND s.status = 'active'
        AND (p_exclude_slot_id IS NULL OR s.slot_id != p_exclude_slot_id)
        -- Time overlap check
        AND (
            (p_start_time >= s.start_time AND p_start_time < s.end_time) OR
            (p_end_time > s.start_time AND p_end_time <= s.end_time) OR
            (p_start_time <= s.start_time AND p_end_time >= s.end_time)
        )
        -- Date range overlap check
        AND (
            (s.effective_to IS NULL OR s.effective_to >= p_effective_from) AND
            (p_effective_to IS NULL OR p_effective_to >= s.effective_from)
        );
    
    -- Check for batch conflicts
    RETURN QUERY
    SELECT 
        'batch_double_booking'::VARCHAR as conflict_type,
        s.slot_id as conflicting_slot_id,
        format('Batch %s is already scheduled on %s from %s to %s', 
               b.batch_name,
               CASE p_day_of_week 
                   WHEN 0 THEN 'Sunday'
                   WHEN 1 THEN 'Monday'
                   WHEN 2 THEN 'Tuesday'
                   WHEN 3 THEN 'Wednesday'
                   WHEN 4 THEN 'Thursday'
                   WHEN 5 THEN 'Friday'
                   WHEN 6 THEN 'Saturday'
               END,
               s.start_time::TEXT,
               s.end_time::TEXT
        ) as conflict_description
    FROM schedule_slots s
    JOIN batches b ON s.batch_id = b.batch_id
    WHERE s.tenant_id = p_tenant_id
        AND s.batch_id = p_batch_id
        AND s.day_of_week = p_day_of_week
        AND s.status = 'active'
        AND (p_exclude_slot_id IS NULL OR s.slot_id != p_exclude_slot_id)
        -- Time overlap check
        AND (
            (p_start_time >= s.start_time AND p_start_time < s.end_time) OR
            (p_end_time > s.start_time AND p_end_time <= s.end_time) OR
            (p_start_time <= s.start_time AND p_end_time >= s.end_time)
        )
        -- Date range overlap check
        AND (
            (s.effective_to IS NULL OR s.effective_to >= p_effective_from) AND
            (p_effective_to IS NULL OR p_effective_to >= s.effective_from)
        );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_conflicts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms
CREATE POLICY rooms_tenant_isolation ON rooms
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for teachers
CREATE POLICY teachers_tenant_isolation ON teachers
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for subjects
CREATE POLICY subjects_tenant_isolation ON subjects
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for batches
CREATE POLICY batches_tenant_isolation ON batches
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for schedule_slots
CREATE POLICY schedule_slots_tenant_isolation ON schedule_slots
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for schedule_overrides
CREATE POLICY schedule_overrides_tenant_isolation ON schedule_overrides
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS Policies for schedule_conflicts
CREATE POLICY schedule_conflicts_tenant_isolation ON schedule_conflicts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- 10. AUDIT TRIGGERS
-- ============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_slots_updated_at BEFORE UPDATE ON schedule_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_overrides_updated_at BEFORE UPDATE ON schedule_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_conflicts_updated_at BEFORE UPDATE ON schedule_conflicts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
