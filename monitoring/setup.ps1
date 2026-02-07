# EduOS Platform - Monitoring Stack Setup Script (PowerShell)
# This script sets up the complete monitoring and observability infrastructure

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "EduOS Monitoring Stack Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
try {
    $dockerVersion = docker --version
    Write-Host "[OK] Docker is installed: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker is not installed" -ForegroundColor Red
    Write-Host "Please install Docker Desktop: https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor Yellow
    exit 1
}

# Check if Docker Compose is installed
try {
    $composeVersion = docker-compose --version
    Write-Host "[OK] Docker Compose is installed: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker Compose is not installed" -ForegroundColor Red
    Write-Host "Please install Docker Compose: https://docs.docker.com/compose/install/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Create necessary directories
Write-Host "Creating monitoring directories..." -ForegroundColor Yellow
$directories = @(
    "monitoring\prometheus\alerts",
    "monitoring\grafana\provisioning\datasources",
    "monitoring\grafana\provisioning\dashboards\json",
    "monitoring\logstash\pipeline",
    "monitoring\jaeger",
    "monitoring\alertmanager"
)

foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}
Write-Host "[OK] Directories created" -ForegroundColor Green
Write-Host ""

# Check if configuration files exist
Write-Host "Checking configuration files..." -ForegroundColor Yellow
$configFiles = @(
    "monitoring\prometheus\prometheus.yml",
    "monitoring\prometheus\alerts\system-alerts.yml",
    "monitoring\prometheus\alerts\application-alerts.yml",
    "monitoring\grafana\provisioning\datasources\prometheus.yml",
    "monitoring\grafana\provisioning\dashboards\dashboard.yml",
    "monitoring\logstash\pipeline\logstash.conf",
    "monitoring\jaeger\jaeger-config.yml",
    "monitoring\alertmanager\alertmanager.yml"
)

$missingFiles = 0
foreach ($file in $configFiles) {
    if (Test-Path $file) {
        Write-Host "[OK] Found: $file" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $file" -ForegroundColor Red
        $missingFiles++
    }
}

if ($missingFiles -gt 0) {
    Write-Host ""
    Write-Host "[ERROR] $missingFiles configuration file(s) missing" -ForegroundColor Red
    Write-Host "Please ensure all configuration files are in place" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[OK] All configuration files found" -ForegroundColor Green
Write-Host ""

# Stop existing containers
Write-Host "Stopping existing monitoring containers..." -ForegroundColor Yellow
try {
    docker-compose down 2>$null
} catch {
    # Ignore errors if no containers are running
}
Write-Host "[OK] Existing containers stopped" -ForegroundColor Green
Write-Host ""

# Pull latest images
Write-Host "Pulling Docker images (this may take a few minutes)..." -ForegroundColor Yellow
docker-compose pull prometheus grafana alertmanager node-exporter postgres-exporter redis-exporter elasticsearch logstash kibana jaeger
Write-Host "[OK] Docker images pulled" -ForegroundColor Green
Write-Host ""

# Start monitoring stack
Write-Host "Starting monitoring stack..." -ForegroundColor Yellow
docker-compose up -d prometheus grafana alertmanager node-exporter postgres-exporter redis-exporter elasticsearch logstash kibana jaeger

# Wait for services to be ready
Write-Host ""
Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service health
Write-Host ""
Write-Host "Checking service health..." -ForegroundColor Yellow

$services = @{
    "Prometheus" = 9090
    "Grafana" = 3001
    "Alertmanager" = 9093
    "Elasticsearch" = 9200
    "Kibana" = 5601
    "Jaeger" = 16686
}

foreach ($service in $services.GetEnumerator()) {
    $name = $service.Key
    $port = $service.Value
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$port" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 302) {
            Write-Host "[OK] $name is running on port $port" -ForegroundColor Green
        } else {
            Write-Host "[WARN] $name may not be ready yet (port $port)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[WARN] $name may not be ready yet (port $port)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Monitoring Stack Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access the monitoring services:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Prometheus:    http://localhost:9090" -ForegroundColor White
Write-Host "  Grafana:       http://localhost:3001 (admin/admin)" -ForegroundColor White
Write-Host "  Alertmanager:  http://localhost:9093" -ForegroundColor White
Write-Host "  Jaeger:        http://localhost:16686" -ForegroundColor White
Write-Host "  Kibana:        http://localhost:5601" -ForegroundColor White
Write-Host "  Elasticsearch: http://localhost:9200" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Install Node.js dependencies:" -ForegroundColor Yellow
Write-Host "     npm install" -ForegroundColor White
Write-Host ""
Write-Host "  2. Configure environment variables in .env:" -ForegroundColor Yellow
Write-Host "     SERVICE_NAME=eduos-api" -ForegroundColor White
Write-Host "     METRICS_ENABLED=true" -ForegroundColor White
Write-Host "     JAEGER_AGENT_HOST=localhost" -ForegroundColor White
Write-Host "     LOGSTASH_ENABLED=true" -ForegroundColor White
Write-Host ""
Write-Host "  3. Integrate middleware in your application" -ForegroundColor Yellow
Write-Host "     See monitoring/README.md for details" -ForegroundColor White
Write-Host ""
Write-Host "  4. Access metrics endpoint:" -ForegroundColor Yellow
Write-Host "     http://localhost:3000/metrics" -ForegroundColor White
Write-Host ""
Write-Host "For more information, see monitoring/README.md" -ForegroundColor Cyan
Write-Host ""
