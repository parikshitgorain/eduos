#!/bin/bash

# EduOS Platform - Monitoring Stack Setup Script
# This script sets up the complete monitoring and observability infrastructure

set -e

echo "=========================================="
echo "EduOS Monitoring Stack Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    echo "Please install Docker Compose first: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"
echo ""

# Create necessary directories
echo "Creating monitoring directories..."
mkdir -p monitoring/prometheus/alerts
mkdir -p monitoring/grafana/provisioning/datasources
mkdir -p monitoring/grafana/provisioning/dashboards/json
mkdir -p monitoring/logstash/pipeline
mkdir -p monitoring/jaeger
mkdir -p monitoring/alertmanager
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Check if configuration files exist
echo "Checking configuration files..."
config_files=(
    "monitoring/prometheus/prometheus.yml"
    "monitoring/prometheus/alerts/system-alerts.yml"
    "monitoring/prometheus/alerts/application-alerts.yml"
    "monitoring/grafana/provisioning/datasources/prometheus.yml"
    "monitoring/grafana/provisioning/dashboards/dashboard.yml"
    "monitoring/logstash/pipeline/logstash.conf"
    "monitoring/jaeger/jaeger-config.yml"
    "monitoring/alertmanager/alertmanager.yml"
)

missing_files=0
for file in "${config_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}✗ Missing: $file${NC}"
        missing_files=$((missing_files + 1))
    else
        echo -e "${GREEN}✓ Found: $file${NC}"
    fi
done

if [ $missing_files -gt 0 ]; then
    echo ""
    echo -e "${RED}Error: $missing_files configuration file(s) missing${NC}"
    echo "Please ensure all configuration files are in place"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ All configuration files found${NC}"
echo ""

# Stop existing containers
echo "Stopping existing monitoring containers..."
docker-compose down 2>/dev/null || true
echo -e "${GREEN}✓ Existing containers stopped${NC}"
echo ""

# Pull latest images
echo "Pulling Docker images (this may take a few minutes)..."
docker-compose pull prometheus grafana alertmanager node-exporter postgres-exporter redis-exporter elasticsearch logstash kibana jaeger
echo -e "${GREEN}✓ Docker images pulled${NC}"
echo ""

# Start monitoring stack
echo "Starting monitoring stack..."
docker-compose up -d prometheus grafana alertmanager node-exporter postgres-exporter redis-exporter elasticsearch logstash kibana jaeger

# Wait for services to be ready
echo ""
echo "Waiting for services to be ready..."
sleep 10

# Check service health
echo ""
echo "Checking service health..."

services=(
    "prometheus:9090"
    "grafana:3001"
    "alertmanager:9093"
    "elasticsearch:9200"
    "kibana:5601"
    "jaeger:16686"
)

for service in "${services[@]}"; do
    name="${service%%:*}"
    port="${service##*:}"
    
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port" | grep -q "200\|302"; then
        echo -e "${GREEN}✓ $name is running on port $port${NC}"
    else
        echo -e "${YELLOW}⚠ $name may not be ready yet (port $port)${NC}"
    fi
done

echo ""
echo "=========================================="
echo -e "${GREEN}Monitoring Stack Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Access the monitoring services:"
echo ""
echo "  📊 Prometheus:    http://localhost:9090"
echo "  📈 Grafana:       http://localhost:3001 (admin/admin)"
echo "  🔔 Alertmanager:  http://localhost:9093"
echo "  🔍 Jaeger:        http://localhost:16686"
echo "  📋 Kibana:        http://localhost:5601"
echo "  🔎 Elasticsearch: http://localhost:9200"
echo ""
echo "Next steps:"
echo ""
echo "  1. Install Node.js dependencies:"
echo "     npm install"
echo ""
echo "  2. Configure environment variables in .env:"
echo "     SERVICE_NAME=eduos-api"
echo "     METRICS_ENABLED=true"
echo "     JAEGER_AGENT_HOST=localhost"
echo "     LOGSTASH_ENABLED=true"
echo ""
echo "  3. Integrate middleware in your application"
echo "     See monitoring/README.md for details"
echo ""
echo "  4. Access metrics endpoint:"
echo "     http://localhost:3000/metrics"
echo ""
echo "For more information, see monitoring/README.md"
echo ""
