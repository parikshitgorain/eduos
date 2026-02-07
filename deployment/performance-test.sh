#!/bin/bash

# EduOS Platform - Performance Testing Script
# Usage: ./performance-test.sh [environment]

set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 [environment]"
    exit 1
fi

echo "========================================="
echo "EduOS Performance Testing"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "========================================="

# Get base URL
if [ "$ENVIRONMENT" == "production" ]; then
    BASE_URL="https://eduos.com"
else
    BASE_URL="https://$ENVIRONMENT.eduos.com"
fi

# Install k6 if not present
if ! command -v k6 &> /dev/null; then
    echo "Installing k6..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install k6
    fi
fi

# Create k6 test script
cat > /tmp/k6-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    stages: [
        { duration: '1m', target: 50 },   // Ramp up to 50 users
        { duration: '3m', target: 50 },   // Stay at 50 users
        { duration: '1m', target: 100 },  // Ramp up to 100 users
        { duration: '3m', target: 100 },  // Stay at 100 users
        { duration: '1m', target: 0 },    // Ramp down to 0 users
    ],
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1000'],
        http_req_failed: ['rate<0.01'],
    },
};

export default function () {
    // Test health endpoint
    let healthRes = http.get(`${__ENV.BASE_URL}/health`);
    check(healthRes, {
        'health status is 200': (r) => r.status === 200,
        'health response time < 200ms': (r) => r.timings.duration < 200,
    });

    sleep(1);

    // Test API endpoint
    let apiRes = http.get(`${__ENV.BASE_URL}/api/v1/version`);
    check(apiRes, {
        'api status is 200': (r) => r.status === 200,
        'api response time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
}
EOF

# Run k6 test
echo "Running performance tests..."
k6 run --env BASE_URL=$BASE_URL /tmp/k6-test.js

# Clean up
rm /tmp/k6-test.js

echo "========================================="
echo "✅ Performance testing completed"
echo "========================================="
