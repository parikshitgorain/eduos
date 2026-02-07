#!/bin/bash

# EduOS Platform - Metrics Monitoring Script
# Usage: ./monitor-metrics.sh [environment]

set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 [environment]"
    exit 1
fi

echo "========================================="
echo "EduOS Metrics Monitoring"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "========================================="

# Configuration
PROMETHEUS_URL="http://prometheus.eduos.com"
MONITORING_DURATION=300  # 5 minutes
CHECK_INTERVAL=30        # 30 seconds

# Thresholds
ERROR_RATE_THRESHOLD=1.0      # 1% error rate
LATENCY_P95_THRESHOLD=500     # 500ms
LATENCY_P99_THRESHOLD=1000    # 1000ms
CPU_THRESHOLD=80              # 80% CPU usage
MEMORY_THRESHOLD=80           # 80% memory usage

# Query Prometheus
query_prometheus() {
    local query=$1
    curl -s -G "$PROMETHEUS_URL/api/v1/query" \
        --data-urlencode "query=$query" | \
        jq -r '.data.result[0].value[1]'
}

# Check error rate
check_error_rate() {
    echo "Checking error rate..."
    
    ERROR_RATE=$(query_prometheus "rate(http_requests_total{status=~\"5..\",environment=\"$ENVIRONMENT\"}[5m]) / rate(http_requests_total{environment=\"$ENVIRONMENT\"}[5m]) * 100")
    
    if [ -z "$ERROR_RATE" ] || [ "$ERROR_RATE" == "null" ]; then
        ERROR_RATE=0
    fi
    
    echo "Error rate: ${ERROR_RATE}%"
    
    if (( $(echo "$ERROR_RATE > $ERROR_RATE_THRESHOLD" | bc -l) )); then
        echo "❌ Error rate exceeds threshold (${ERROR_RATE}% > ${ERROR_RATE_THRESHOLD}%)"
        return 1
    else
        echo "✅ Error rate within threshold"
        return 0
    fi
}

# Check latency
check_latency() {
    echo "Checking latency..."
    
    P95_LATENCY=$(query_prometheus "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{environment=\"$ENVIRONMENT\"}[5m])) * 1000")
    P99_LATENCY=$(query_prometheus "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{environment=\"$ENVIRONMENT\"}[5m])) * 1000")
    
    if [ -z "$P95_LATENCY" ] || [ "$P95_LATENCY" == "null" ]; then
        P95_LATENCY=0
    fi
    
    if [ -z "$P99_LATENCY" ] || [ "$P99_LATENCY" == "null" ]; then
        P99_LATENCY=0
    fi
    
    echo "P95 latency: ${P95_LATENCY}ms"
    echo "P99 latency: ${P99_LATENCY}ms"
    
    LATENCY_OK=true
    
    if (( $(echo "$P95_LATENCY > $LATENCY_P95_THRESHOLD" | bc -l) )); then
        echo "⚠️  P95 latency exceeds threshold (${P95_LATENCY}ms > ${LATENCY_P95_THRESHOLD}ms)"
        LATENCY_OK=false
    fi
    
    if (( $(echo "$P99_LATENCY > $LATENCY_P99_THRESHOLD" | bc -l) )); then
        echo "⚠️  P99 latency exceeds threshold (${P99_LATENCY}ms > ${LATENCY_P99_THRESHOLD}ms)"
        LATENCY_OK=false
    fi
    
    if [ "$LATENCY_OK" = true ]; then
        echo "✅ Latency within thresholds"
        return 0
    else
        return 1
    fi
}

# Check resource usage
check_resources() {
    echo "Checking resource usage..."
    
    CPU_USAGE=$(query_prometheus "avg(rate(container_cpu_usage_seconds_total{namespace=\"eduos-$ENVIRONMENT\"}[5m])) * 100")
    MEMORY_USAGE=$(query_prometheus "avg(container_memory_usage_bytes{namespace=\"eduos-$ENVIRONMENT\"} / container_spec_memory_limit_bytes{namespace=\"eduos-$ENVIRONMENT\"}) * 100")
    
    if [ -z "$CPU_USAGE" ] || [ "$CPU_USAGE" == "null" ]; then
        CPU_USAGE=0
    fi
    
    if [ -z "$MEMORY_USAGE" ] || [ "$MEMORY_USAGE" == "null" ]; then
        MEMORY_USAGE=0
    fi
    
    echo "CPU usage: ${CPU_USAGE}%"
    echo "Memory usage: ${MEMORY_USAGE}%"
    
    RESOURCES_OK=true
    
    if (( $(echo "$CPU_USAGE > $CPU_THRESHOLD" | bc -l) )); then
        echo "⚠️  CPU usage exceeds threshold (${CPU_USAGE}% > ${CPU_THRESHOLD}%)"
        RESOURCES_OK=false
    fi
    
    if (( $(echo "$MEMORY_USAGE > $MEMORY_THRESHOLD" | bc -l) )); then
        echo "⚠️  Memory usage exceeds threshold (${MEMORY_USAGE}% > ${MEMORY_THRESHOLD}%)"
        RESOURCES_OK=false
    fi
    
    if [ "$RESOURCES_OK" = true ]; then
        echo "✅ Resource usage within thresholds"
        return 0
    else
        return 1
    fi
}

# Main monitoring loop
echo "Starting monitoring for $MONITORING_DURATION seconds..."
echo ""

START_TIME=$(date +%s)
CHECKS_PASSED=0
CHECKS_FAILED=0

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    if [ $ELAPSED -ge $MONITORING_DURATION ]; then
        break
    fi
    
    echo "Check at $(date) (${ELAPSED}s elapsed)..."
    echo "---"
    
    # Run checks
    CHECK_FAILED=false
    
    if ! check_error_rate; then
        CHECK_FAILED=true
    fi
    
    echo ""
    
    if ! check_latency; then
        CHECK_FAILED=true
    fi
    
    echo ""
    
    if ! check_resources; then
        CHECK_FAILED=true
    fi
    
    echo ""
    
    if [ "$CHECK_FAILED" = true ]; then
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        echo "❌ Check failed"
    else
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        echo "✅ Check passed"
    fi
    
    echo "========================================="
    echo ""
    
    # Wait before next check
    REMAINING=$((MONITORING_DURATION - ELAPSED))
    if [ $REMAINING -ge $CHECK_INTERVAL ]; then
        sleep $CHECK_INTERVAL
    else
        sleep $REMAINING
    fi
done

# Summary
echo "========================================="
echo "Monitoring Summary"
echo "========================================="
echo "Duration: ${MONITORING_DURATION}s"
echo "Checks passed: $CHECKS_PASSED"
echo "Checks failed: $CHECKS_FAILED"
echo "Total checks: $((CHECKS_PASSED + CHECKS_FAILED))"
echo "========================================="

if [ $CHECKS_FAILED -eq 0 ]; then
    echo "✅ All monitoring checks passed"
    exit 0
else
    echo "⚠️  Some monitoring checks failed"
    exit 1
fi
