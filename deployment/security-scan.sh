#!/bin/bash

# EduOS Platform - Security Scanning Script
# Usage: ./security-scan.sh [environment]

set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 [environment]"
    exit 1
fi

echo "========================================="
echo "EduOS Security Scanning"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "========================================="

# Get base URL
if [ "$ENVIRONMENT" == "production" ]; then
    BASE_URL="https://eduos.com"
else
    BASE_URL="https://$ENVIRONMENT.eduos.com"
fi

# Test 1: SSL/TLS Configuration
echo "Testing SSL/TLS configuration..."
if command -v testssl &> /dev/null; then
    testssl --quiet --severity MEDIUM $BASE_URL
else
    echo "⚠️  testssl not installed, skipping SSL tests"
fi

# Test 2: Security Headers
echo ""
echo "Testing security headers..."
HEADERS=$(curl -s -I $BASE_URL)

check_header() {
    local header=$1
    if echo "$HEADERS" | grep -qi "$header"; then
        echo "✅ $header present"
    else
        echo "❌ $header missing"
    fi
}

check_header "Strict-Transport-Security"
check_header "X-Frame-Options"
check_header "X-Content-Type-Options"
check_header "X-XSS-Protection"
check_header "Content-Security-Policy"

# Test 3: Common Vulnerabilities
echo ""
echo "Testing for common vulnerabilities..."

# Test for directory listing
echo "Checking directory listing..."
DIR_LISTING=$(curl -s $BASE_URL/static/ | grep -i "index of" || echo "")
if [ -z "$DIR_LISTING" ]; then
    echo "✅ Directory listing disabled"
else
    echo "❌ Directory listing enabled"
fi

# Test for sensitive file exposure
echo "Checking for sensitive files..."
SENSITIVE_FILES=(".env" ".git/config" "package.json" "docker-compose.yml")

for file in "${SENSITIVE_FILES[@]}"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/$file")
    if [ "$HTTP_CODE" == "404" ] || [ "$HTTP_CODE" == "403" ]; then
        echo "✅ $file not exposed"
    else
        echo "❌ $file exposed (HTTP $HTTP_CODE)"
    fi
done

# Test 4: Rate Limiting
echo ""
echo "Testing rate limiting..."
RATE_LIMIT_TRIGGERED=false

for i in {1..150}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/version")
    if [ "$HTTP_CODE" == "429" ]; then
        RATE_LIMIT_TRIGGERED=true
        break
    fi
done

if [ "$RATE_LIMIT_TRIGGERED" = true ]; then
    echo "✅ Rate limiting active"
else
    echo "⚠️  Rate limiting not detected"
fi

# Test 5: SQL Injection (basic test)
echo ""
echo "Testing SQL injection protection..."
SQL_INJECTION_PAYLOADS=("' OR '1'='1" "1; DROP TABLE users--" "' UNION SELECT NULL--")

for payload in "${SQL_INJECTION_PAYLOADS[@]}"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/students?search=$payload")
    if [ "$HTTP_CODE" == "400" ] || [ "$HTTP_CODE" == "403" ]; then
        echo "✅ SQL injection payload blocked: $payload"
    else
        echo "⚠️  SQL injection payload not blocked: $payload (HTTP $HTTP_CODE)"
    fi
done

# Test 6: XSS Protection
echo ""
echo "Testing XSS protection..."
XSS_PAYLOADS=("<script>alert('XSS')</script>" "<img src=x onerror=alert('XSS')>")

for payload in "${XSS_PAYLOADS[@]}"; do
    RESPONSE=$(curl -s "$BASE_URL/api/v1/students?search=$payload")
    if echo "$RESPONSE" | grep -q "<script>"; then
        echo "❌ XSS payload not sanitized: $payload"
    else
        echo "✅ XSS payload sanitized: $payload"
    fi
done

echo ""
echo "========================================="
echo "✅ Security scanning completed"
echo "========================================="
