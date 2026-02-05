-- Test Suite: RLS Tenant Isolation
-- Description: Validates that Row-Level Security policies enforce tenant isolation
-- Version: 1.0
-- Date: 2026-02-04

-- ============================================================================
-- TEST SETUP
-- ============================================================================

-- Create test tenants
INSERT INTO tenants (tenant_id, name, subdomain, tier)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Test School A', 'school-a', 'Business'),
    ('22222222-2222-2222-2222-222222222222', 'Test School B', 'school-b', 'Business')
ON CONFLICT (tenant_id) DO NOTHING;

-- Create test students for Tenant A
INSERT INTO students (student_id, tenant_id, first_name, last_name, email)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Alice', 'Anderson', 'alice@schoola.com'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', '11111111-1111-1111-1111-111111111111', 'Bob', 'Brown', 'bob@schoola.com')
ON CONFLICT (student_id) DO NOTHING;

-- Create test students for Tenant B
INSERT INTO students (student_id, tenant_id, first_name, last_name, email)
VALUES 
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Charlie', 'Chen', 'charlie@schoolb.com'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc', '22222222-2222-2222-2222-222222222222', 'Diana', 'Davis', 'diana@schoolb.com')
ON CONFLICT (student_id) DO NOTHING;

-- Create test enrollments
INSERT INTO enrollments (enrollment_id, tenant_id, student_id, batch_id, start_date)
VALUES 
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeea', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'batch-a-1', '2026-01-01'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeeb', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'batch-b-1', '2026-01-01')
ON CONFLICT (enrollment_id) DO NOTHING;

-- Create test attendance records
INSERT INTO attendance (attendance_id, tenant_id, student_id, event_id, attendance_date, status)
VALUES 
    ('aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'event-a-1', '2026-02-01', 'present'),
    ('bbbbbbbb-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'event-b-1', '2026-02-01', 'present')
ON CONFLICT (attendance_id) DO NOTHING;

-- Create test payments
INSERT INTO payments (payment_id, tenant_id, student_id, amount, payment_status)
VALUES 
    ('pppppppp-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 5000.00, 'completed'),
    ('pppppppp-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 6000.00, 'completed')
ON CONFLICT (payment_id) DO NOTHING;

-- ============================================================================
-- TEST 1: Verify RLS is enabled on all core tables
-- ============================================================================

DO $$
DECLARE
    rls_enabled_students BOOLEAN;
    rls_enabled_enrollments BOOLEAN;
    rls_enabled_attendance BOOLEAN;
    rls_enabled_payments BOOLEAN;
BEGIN
    -- Check if RLS is enabled
    SELECT relrowsecurity INTO rls_enabled_students
    FROM pg_class WHERE relname = 'students';
    
    SELECT relrowsecurity INTO rls_enabled_enrollments
    FROM pg_class WHERE relname = 'enrollments';
    
    SELECT relrowsecurity INTO rls_enabled_attendance
    FROM pg_class WHERE relname = 'attendance';
    
    SELECT relrowsecurity INTO rls_enabled_payments
    FROM pg_class WHERE relname = 'payments';
    
    -- Assert all tables have RLS enabled
    IF NOT rls_enabled_students THEN
        RAISE EXCEPTION 'TEST FAILED: RLS not enabled on students table';
    END IF;
    
    IF NOT rls_enabled_enrollments THEN
        RAISE EXCEPTION 'TEST FAILED: RLS not enabled on enrollments table';
    END IF;
    
    IF NOT rls_enabled_attendance THEN
        RAISE EXCEPTION 'TEST FAILED: RLS not enabled on attendance table';
    END IF;
    
    IF NOT rls_enabled_payments THEN
        RAISE EXCEPTION 'TEST FAILED: RLS not enabled on payments table';
    END IF;
    
    RAISE NOTICE 'TEST 1 PASSED: RLS is enabled on all core tables';
END $$;

-- ============================================================================
-- TEST 2: Verify tenant isolation for students table
-- ============================================================================

DO $$
DECLARE
    tenant_a_count INTEGER;
    tenant_b_count INTEGER;
    cross_tenant_count INTEGER;
BEGIN
    -- Set context to Tenant A
    PERFORM set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', TRUE);
    
    -- Count students visible to Tenant A
    SELECT COUNT(*) INTO tenant_a_count FROM students;
    
    -- Should see exactly 2 students (Alice and Bob)
    IF tenant_a_count != 2 THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant A should see 2 students, but sees %', tenant_a_count;
    END IF;
    
    -- Set context to Tenant B
    PERFORM set_config('app.current_tenant_id', '22222222-2222-2222-2222-222222222222', TRUE);
    
    -- Count students visible to Tenant B
    SELECT COUNT(*) INTO tenant_b_count FROM students;
    
    -- Should see exactly 2 students (Charlie and Diana)
    IF tenant_b_count != 2 THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant B should see 2 students, but sees %', tenant_b_count;
    END IF;
    
    -- Verify Tenant A cannot see Tenant B's students
    PERFORM set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', TRUE);
    SELECT COUNT(*) INTO cross_tenant_count 
    FROM students 
    WHERE student_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    
    IF cross_tenant_count != 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant A can see Tenant B students (cross-tenant leak)';
    END IF;
    
    RAISE NOTICE 'TEST 2 PASSED: Students table enforces tenant isolation';
END $$;

-- ============================================================================
-- TEST 3: Verify tenant isolation for enrollments table
-- ============================================================================

DO $$
DECLARE
    tenant_a_count INTEGER;
    tenant_b_count INTEGER;
BEGIN
    -- Set context to Tenant A
    PERFORM set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', TRUE);
    SELECT COUNT(*) INTO tenant_a_count FROM enrollments;
    
    IF tenant_a_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant A should see 1 enrollment, but sees %', tenant_a_count;
    END IF;
    
    -- Set context to Tenant B
    PERFORM set_config('app.current_tenant_id', '22222222-2222-2222-2222-222222222222', TRUE);
    SELECT COUNT(*) INTO tenant_b_count FROM enrollments;
    
    IF tenant_b_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant B should see 1 enrollment, but sees %', tenant_b_count;
    END IF;
    
    RAISE NOTICE 'TEST 3 PASSED: Enrollments table enforces tenant isolation';
END $$;

-- ============================================================================
-- TEST 4: Verify tenant isolation for attendance table
-- ============================================================================

DO $$
DECLARE
    tenant_a_count INTEGER;
    tenant_b_count INTEGER;
BEGIN
    -- Set context to Tenant A
    PERFORM set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', TRUE);
    SELECT COUNT(*) INTO tenant_a_count FROM attendance;
    
    IF tenant_a_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant A should see 1 attendance record, but sees %', tenant_a_count;
    END IF;
    
    -- Set context to Tenant B
    PERFORM set_config('app.current_tenant_id', '22222222-2222-2222-2222-222222222222', TRUE);
    SELECT COUNT(*) INTO tenant_b_count FROM attendance;
    
    IF tenant_b_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant B should see 1 attendance record, but sees %', tenant_b_count;
    END IF;
    
    RAISE NOTICE 'TEST 4 PASSED: Attendance table enforces tenant isolation';
END $$;

-- ============================================================================
-- TEST 5: Verify tenant isolation for payments table
-- ============================================================================

DO $$
DECLARE
    tenant_a_count INTEGER;
    tenant_b_count INTEGER;
BEGIN
    -- Set context to Tenant A
    PERFORM set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', TRUE);
    SELECT COUNT(*) INTO tenant_a_count FROM payments;
    
    IF tenant_a_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant A should see 1 payment, but sees %', tenant_a_count;
    END IF;
    
    -- Set context to Tenant B
    PERFORM set_config('app.current_tenant_id', '22222222-2222-2222-2222-222222222222', TRUE);
    SELECT COUNT(*) INTO tenant_b_count FROM payments;
    
    IF tenant_b_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant B should see 1 payment, but sees %', tenant_b_count;
    END IF;
    
    RAISE NOTICE 'TEST 5 PASSED: Payments table enforces tenant isolation';
END $$;

-- ============================================================================
-- TEST 6: Verify INSERT operations respect tenant context
-- ============================================================================

DO $$
DECLARE
    inserted_student_id UUID;
    visible_count INTEGER;
BEGIN
    -- Set context to Tenant A
    PERFORM set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', TRUE);
    
    -- Insert a new student for Tenant A
    INSERT INTO students (student_id, tenant_id, first_name, last_name, email)
    VALUES (uuid_generate_v4(), '11111111-1111-1111-1111-111111111111', 'Test', 'User', 'test@schoola.com')
    RETURNING student_id INTO inserted_student_id;
    
    -- Verify the student is visible to Tenant A
    SELECT COUNT(*) INTO visible_count 
    FROM students 
    WHERE student_id = inserted_student_id;
    
    IF visible_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Inserted student not visible to Tenant A';
    END IF;
    
    -- Switch to Tenant B
    PERFORM set_config('app.current_tenant_id', '22222222-2222-2222-2222-222222222222', TRUE);
    
    -- Verify the student is NOT visible to Tenant B
    SELECT COUNT(*) INTO visible_count 
    FROM students 
    WHERE student_id = inserted_student_id;
    
    IF visible_count != 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant B can see Tenant A student after insert';
    END IF;
    
    RAISE NOTICE 'TEST 6 PASSED: INSERT operations respect tenant context';
    
    -- Cleanup
    PERFORM set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', TRUE);
    DELETE FROM students WHERE student_id = inserted_student_id;
END $$;

-- ============================================================================
-- TEST 7: Verify UPDATE operations respect tenant context
-- ============================================================================

DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Set context to Tenant A
    PERFORM set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', TRUE);
    
    -- Try to update a Tenant B student (should fail silently - 0 rows affected)
    UPDATE students 
    SET first_name = 'Hacked'
    WHERE student_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count != 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant A was able to update Tenant B student';
    END IF;
    
    -- Verify Tenant B student is unchanged
    PERFORM set_config('app.current_tenant_id', '22222222-2222-2222-2222-222222222222', TRUE);
    
    IF EXISTS (SELECT 1 FROM students WHERE student_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND first_name = 'Hacked') THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant B student was modified by Tenant A';
    END IF;
    
    RAISE NOTICE 'TEST 7 PASSED: UPDATE operations respect tenant context';
END $$;

-- ============================================================================
-- TEST 8: Verify DELETE operations respect tenant context
-- ============================================================================

DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Set context to Tenant A
    PERFORM set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', TRUE);
    
    -- Try to delete a Tenant B student (should fail silently - 0 rows affected)
    DELETE FROM students 
    WHERE student_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count != 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant A was able to delete Tenant B student';
    END IF;
    
    -- Verify Tenant B student still exists
    PERFORM set_config('app.current_tenant_id', '22222222-2222-2222-2222-222222222222', TRUE);
    
    IF NOT EXISTS (SELECT 1 FROM students WHERE student_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') THEN
        RAISE EXCEPTION 'TEST FAILED: Tenant B student was deleted by Tenant A';
    END IF;
    
    RAISE NOTICE 'TEST 8 PASSED: DELETE operations respect tenant context';
END $$;

-- ============================================================================
-- TEST 9: Verify cross-tenant access attempt returns 403-equivalent
-- ============================================================================

DO $$
DECLARE
    cross_tenant_visible INTEGER;
BEGIN
    -- Set context to Tenant A
    PERFORM set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', TRUE);
    
    -- Attempt to query Tenant B data
    SELECT COUNT(*) INTO cross_tenant_visible
    FROM students
    WHERE tenant_id = '22222222-2222-2222-2222-222222222222';
    
    -- Should return 0 rows (RLS blocks access)
    IF cross_tenant_visible != 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Cross-tenant access returned % rows instead of 0', cross_tenant_visible;
    END IF;
    
    RAISE NOTICE 'TEST 9 PASSED: Cross-tenant access attempts are blocked';
END $$;

-- ============================================================================
-- TEST 10: Verify performance overhead is acceptable (< 5ms)
-- ============================================================================

DO $$
DECLARE
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    duration_ms NUMERIC;
BEGIN
    -- Set context to Tenant A
    PERFORM set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', TRUE);
    
    -- Measure query time
    start_time := clock_timestamp();
    
    PERFORM COUNT(*) FROM students;
    
    end_time := clock_timestamp();
    duration_ms := EXTRACT(MILLISECONDS FROM (end_time - start_time));
    
    -- Performance should be under 5ms for simple queries
    IF duration_ms > 5 THEN
        RAISE WARNING 'TEST WARNING: RLS overhead is % ms (target: < 5ms)', duration_ms;
    ELSE
        RAISE NOTICE 'TEST 10 PASSED: RLS overhead is % ms (< 5ms target)', duration_ms;
    END IF;
END $$;

-- ============================================================================
-- TEST CLEANUP
-- ============================================================================

-- Clean up test data
DELETE FROM payments WHERE payment_id IN ('pppppppp-1111-1111-1111-111111111111', 'pppppppp-2222-2222-2222-222222222222');
DELETE FROM attendance WHERE attendance_id IN ('aaaaaaaa-1111-1111-1111-111111111111', 'bbbbbbbb-2222-2222-2222-222222222222');
DELETE FROM enrollments WHERE enrollment_id IN ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeea', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeeb');
DELETE FROM students WHERE student_id IN (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc'
);
DELETE FROM tenants WHERE tenant_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- ============================================================================
-- ALL TESTS COMPLETE
-- ============================================================================

SELECT 'ALL RLS ISOLATION TESTS PASSED' AS test_result;
