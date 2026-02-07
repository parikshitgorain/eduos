#!/bin/bash

# AI Kill Switch Test Script
# Demonstrates the kill switch functionality

echo "==================================="
echo "AI Kill Switch Test Script"
echo "==================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000/api/v1/ai"
AI_SERVICE_URL="http://localhost:8000/api/v1"

echo "1. Checking initial kill switch status..."
curl -s "$API_URL/kill-switch" | jq '.'
echo ""

echo "2. Testing AI service (should work when enabled)..."
curl -s -X POST "$AI_SERVICE_URL/semantic/pairwise-similarity" \
  -H "Content-Type: application/json" \
  -d '{
    "student1": {
      "first_name": "John",
      "last_name": "Doe",
      "date_of_birth": "2005-03-15"
    },
    "student2": {
      "first_name": "Jon",
      "last_name": "Doe",
      "date_of_birth": "2005-03-15"
    }
  }' | jq '.semantic_similarity // .detail'
echo ""

echo "3. Disabling AI services via kill switch..."
curl -s -X POST "$API_URL/kill-switch/toggle" \
  -H "Content-Type: application/json" \
  -d '{
    "enable": false,
    "reason": "Testing kill switch functionality"
  }' | jq '.'
echo ""

echo "4. Verifying kill switch is disabled..."
curl -s "$API_URL/kill-switch" | jq '.'
echo ""

echo "5. Testing AI service (should be blocked)..."
RESPONSE=$(curl -s -X POST "$AI_SERVICE_URL/semantic/pairwise-similarity" \
  -H "Content-Type: application/json" \
  -d '{
    "student1": {
      "first_name": "John",
      "last_name": "Doe",
      "date_of_birth": "2005-03-15"
    },
    "student2": {
      "first_name": "Jon",
      "last_name": "Doe",
      "date_of_birth": "2005-03-15"
    }
  }')

if echo "$RESPONSE" | grep -q "AI services are currently disabled"; then
  echo -e "${GREEN}✓ AI service correctly blocked${NC}"
  echo "$RESPONSE" | jq '.detail'
else
  echo -e "${RED}✗ AI service was not blocked${NC}"
  echo "$RESPONSE" | jq '.'
fi
echo ""

echo "6. Re-enabling AI services..."
curl -s -X POST "$API_URL/kill-switch/toggle" \
  -H "Content-Type: application/json" \
  -d '{
    "enable": true,
    "reason": "Test complete - re-enabling AI"
  }' | jq '.'
echo ""

echo "7. Verifying kill switch is enabled..."
curl -s "$API_URL/kill-switch" | jq '.'
echo ""

echo "8. Testing AI service (should work again)..."
curl -s -X POST "$AI_SERVICE_URL/semantic/pairwise-similarity" \
  -H "Content-Type: application/json" \
  -d '{
    "student1": {
      "first_name": "John",
      "last_name": "Doe",
      "date_of_birth": "2005-03-15"
    },
    "student2": {
      "first_name": "Jon",
      "last_name": "Doe",
      "date_of_birth": "2005-03-15"
    }
  }' | jq '.semantic_similarity // .detail'
echo ""

echo "9. Checking kill switch history..."
curl -s "$API_URL/kill-switch/history?limit=5" | jq '.data.history | length'
echo ""

echo "==================================="
echo -e "${GREEN}Kill Switch Test Complete!${NC}"
echo "==================================="
