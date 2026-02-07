#!/bin/bash

# EduOS Platform - Traffic Shift Script
# Usage: ./traffic-shift.sh [blue|green] [percentage]

set -e

COLOR=$1
PERCENTAGE=$2

if [ -z "$COLOR" ] || [ -z "$PERCENTAGE" ]; then
    echo "Usage: $0 [blue|green] [percentage]"
    exit 1
fi

if [ "$PERCENTAGE" -lt 0 ] || [ "$PERCENTAGE" -gt 100 ]; then
    echo "Error: Percentage must be between 0 and 100"
    exit 1
fi

echo "========================================="
echo "EduOS Traffic Shift"
echo "========================================="
echo "Target Color: $COLOR"
echo "Traffic Percentage: $PERCENTAGE%"
echo "========================================="

# Determine opposite color
if [ "$COLOR" == "blue" ]; then
    OTHER_COLOR="green"
else
    OTHER_COLOR="blue"
fi

OTHER_PERCENTAGE=$((100 - PERCENTAGE))

echo "Traffic distribution:"
echo "  $COLOR: $PERCENTAGE%"
echo "  $OTHER_COLOR: $OTHER_PERCENTAGE%"

# Update Kubernetes service weights using Istio VirtualService
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: eduos-platform
  namespace: eduos-production
spec:
  hosts:
  - eduos.com
  - www.eduos.com
  http:
  - match:
    - uri:
        prefix: /
    route:
    - destination:
        host: eduos-platform-$COLOR
        port:
          number: 3000
      weight: $PERCENTAGE
    - destination:
        host: eduos-platform-$OTHER_COLOR
        port:
          number: 3000
      weight: $OTHER_PERCENTAGE
EOF

echo "✅ Traffic shift applied successfully"

# Monitor traffic distribution
echo ""
echo "Monitoring traffic distribution for 30 seconds..."
sleep 30

# Verify traffic distribution
echo ""
echo "Verifying traffic distribution..."

BLUE_REQUESTS=$(kubectl logs -n eduos-production -l color=blue --tail=100 | wc -l)
GREEN_REQUESTS=$(kubectl logs -n eduos-production -l color=green --tail=100 | wc -l)
TOTAL_REQUESTS=$((BLUE_REQUESTS + GREEN_REQUESTS))

if [ $TOTAL_REQUESTS -gt 0 ]; then
    BLUE_PERCENT=$((BLUE_REQUESTS * 100 / TOTAL_REQUESTS))
    GREEN_PERCENT=$((GREEN_REQUESTS * 100 / TOTAL_REQUESTS))
    
    echo "Actual traffic distribution:"
    echo "  Blue: $BLUE_PERCENT% ($BLUE_REQUESTS requests)"
    echo "  Green: $GREEN_PERCENT% ($GREEN_REQUESTS requests)"
else
    echo "⚠️  No traffic detected in the last 30 seconds"
fi

echo "========================================="
echo "Traffic shift completed"
echo "========================================="
