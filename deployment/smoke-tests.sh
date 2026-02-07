#!/bin/bash

# EduOS Platform - Smoke Tests Script
# Usage: ./smoke-tests.sh [blue|green] [environment]

set -e

COLOR=$1
ENVIRONMENT=$2

if [ -z "$COLOR" ] || [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 [blue|green] [environment]"
    exit 1
fi

echo "========================================="
echo "EduOS Smoke Tests"
echo "========================================="
echo "Color: $COLOR"
echo "Environment: $ENVIRONMENT"
echo "========================================="

# Get service endpoint
if [ "$ENVIRONMENT" == "production" ]; then
    BASE_URL="https://$COLOR.eduos.com"
else
    BASE_URL="https://$ENVIRONMENT-$COLOR.eduos.com"
fi

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name=$1
    local endpoint=$2
    local expected_code=$3
    
    echo "Running test: $test_name"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" || echo "000")
    
    if [ "$HTTP_CODE" == "$expected_code" ]; then
        echo "✅ PASS: $test_name (HTTP $HTTP_CODE)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo "❌ FAIL: $test_name (Expected HTTP $expected_code, got $HTTP_CODE)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test authenticated endpoint
run_authenticated_test() {
    local test_name=$1
    local endpoint=$2
    local expected_code=$3
    local token=$4
    
    echo "Running authenticated test: $test_name"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $token" \
        "$BASE_URL$endpoint" || echo "000")
    
    if [ "$HTTP_CODE" == "$expected_code" ]; then
        echo "✅ PASS: $test_name (HTTP $HTTP_CODE)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo "❌ FAIL: $test_name (Expected HTTP $expected_code, got $HTTP_CODE)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo ""
echo "Running smoke tests..."
echo ""

# Test 1: Health endpoint
run_test "Health Check" "/health" "200"

# Test 2: Version endpoint
run_test "Version Check" "/api/v1/version" "200"

# Test 3: API root
run_test "API Root" "/api/v1" "200"

# Test 4: Metrics endpoint (should be protected)
run_test "Metrics Endpoint" "/metrics" "401"

# Test 5: Non-existent endpoint
run_test "404 Handling" "/api/v1/nonexistent" "404"

# Test 6: Database connectivity
echo "Testing database connectivity..."
RESPONSE=$(curl -s "$BASE_URL/health")
DB_STATUS=$(echo $RESPONSE | jq -r '.database')

if [ "$DB_STATUS" == "connected" ]; then
    echo "✅ PASS: Database connectivity"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "❌ FAIL: Database connectivity (Status: $DB_STATUS)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 7: Redis connectivity
REDIS_STATUS=$(echo $RESPONSE | jq -r '.redis')

if [ "$REDIS_STATUS" == "connected" ]; then
    echo "✅ PASS: Redis connectivity"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "❌ FAIL: Redis connectivity (Status: $REDIS_STATUS)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 8: Response time check
echo "Testing response time..."
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/health")
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc)

if (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
    echo "✅ PASS: Response time (${RESPONSE_TIME_MS}ms < 1000ms)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "⚠️  WARNING: Response time (${RESPONSE_TIME_MS}ms >= 1000ms)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

# Test 9: CORS headers
echo "Testing CORS headers..."
CORS_HEADER=$(curl -s -I "$BASE_URL/api/v1" | grep -i "access-control-allow-origin" || echo "")

if [ -n "$CORS_HEADER" ]; then
    echo "✅ PASS: CORS headers present"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "⚠️  WARNING: CORS headers not found"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

# Test 10: Security headers
echo "Testing security headers..."
SECURITY_HEADERS=$(curl -s -I "$BASE_URL/api/v1")

if echo "$SECURITY_HEADERS" | grep -qi "x-frame-options"; then
    echo "✅ PASS: X-Frame-Options header present"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "❌ FAIL: X-Frame-Options header missing"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Summary
echo ""
echo "========================================="
echo "Smoke Test Results"
echo "========================================="
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo "========================================="

if [ $TESTS_FAILED -eq 0 ]; then
    echo "✅ All smoke tests passed"
    exit 0
else
    echo "❌ Some smoke tests failed"
    exit 1
fi
