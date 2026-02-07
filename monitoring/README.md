# EduOS Platform - Monitoring and Observability Stack

This directory contains the complete monitoring and observability infrastructure for the EduOS Platform, implementing task 4.4.1 from the implementation plan.

## Overview

The monitoring stack provides comprehensive visibility into system health, application performance, and operational metrics through:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Metrics visualization and dashboards
- **Alertmanager**: Alert routing and notification management
- **Jaeger**: Distributed tracing across microservices
- **ELK Stack**: Centralized log aggregation and analysis
  - Elasticsearch: Log storage and search
  - Logstash: Log processing and aggregation
  - Kibana: Log visualization and analysis

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Express.js  │  │  PostgreSQL  │  │    Redis     │         │
│  │  + Metrics   │  │  + Exporter  │  │  + Exporter  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Metrics Collection                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Prometheus                             │  │
│  │  • Scrapes metrics every 15s                             │  │
│  │  • Evaluates alert rules                                 │  │
│  │  • Stores time-series data                               │  │
│  └──────────────────┬───────────────────────────────────────┘  │
└─────────────────────┼───────────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐
│  Grafana    │ │ Alertmanager│ │    Distributed Tracing      │
│  Dashboards │ │  Routing    │ │         (Jaeger)            │
└─────────────┘ └─────────────┘ └─────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │  Email  │ │  Slack  │ │PagerDuty│
    └─────────┘ └─────────┘ └─────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Log Aggregation (ELK)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Application Logs → Logstash → Elasticsearch → Kibana    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Prometheus (Port 9090)

**Purpose**: Metrics collection and storage

**Configuration**: `prometheus/prometheus.yml`

**Scrape Targets**:
- EduOS API (port 3000)
- PostgreSQL Exporter (port 9187)
- Redis Exporter (port 9121)
- Node Exporter (port 9100)
- AI Service (port 8000)
- Jaeger (port 14269)

**Alert Rules**:
- `alerts/system-alerts.yml`: CPU, memory, disk, instance health
- `alerts/application-alerts.yml`: API latency, error rates, database, cache

**Access**: http://localhost:9090

### 2. Grafana (Port 3001)

**Purpose**: Metrics visualization and dashboards

**Configuration**: `grafana/provisioning/`

**Default Credentials**:
- Username: `admin`
- Password: `admin`

**Pre-configured Dashboards**:
- **System Health**: CPU, memory, disk, network metrics
- **API Performance**: Request rate, error rate, latency (P50/P95/P99), status codes

**Access**: http://localhost:3001

### 3. Alertmanager (Port 9093)

**Purpose**: Alert routing and notification management

**Configuration**: `alertmanager/alertmanager.yml`

**Alert Routing**:
- **Critical**: Immediate notification (Email + Slack + PagerDuty)
- **Warning**: Batched notifications (30s delay)
- **Info**: Daily digest
- **Security**: Immediate to security team
- **Database**: To database team

**Access**: http://localhost:9093

### 4. Jaeger (Port 16686)

**Purpose**: Distributed tracing

**Configuration**: `jaeger/jaeger-config.yml`

**Features**:
- Request flow visualization
- Service dependency mapping
- Performance bottleneck identification
- Error tracking across services

**Sampling**: 10% of requests (configurable)

**Storage**: Elasticsearch

**Access**: http://localhost:16686

### 5. ELK Stack

#### Elasticsearch (Port 9200)

**Purpose**: Log storage and search engine

**Indices**:
- `eduos-logs-*`: General application logs
- `eduos-errors-*`: Error logs
- `eduos-audit-*`: Audit logs
- `eduos-security-*`: Security logs
- `jaeger-*`: Distributed tracing data

**Access**: http://localhost:9200

#### Logstash (Ports 5000, 5001, 5044)

**Purpose**: Log processing and aggregation

**Configuration**: `logstash/pipeline/logstash.conf`

**Input Ports**:
- 5044: Beats protocol (Filebeat)
- 5000: TCP (JSON logs)
- 5001: UDP (Syslog)

**Processing**:
- JSON parsing
- Field extraction (tenant_id, user_id, service)
- Geo-location enrichment
- Tag-based routing

#### Kibana (Port 5601)

**Purpose**: Log visualization and analysis

**Features**:
- Log search and filtering
- Real-time log streaming
- Custom dashboards
- Saved searches

**Access**: http://localhost:5601

### 6. Exporters

#### Node Exporter (Port 9100)
- System metrics: CPU, memory, disk, network
- Process metrics
- Filesystem metrics

#### Postgres Exporter (Port 9187)
- Database connections
- Query performance
- Table statistics
- Replication lag

#### Redis Exporter (Port 9121)
- Memory usage
- Key statistics
- Command statistics
- Replication info

## Quick Start

### 1. Start the Monitoring Stack

```bash
# Start all monitoring services
docker-compose up -d

# Verify all services are running
docker-compose ps

# Check logs
docker-compose logs -f prometheus grafana
```

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Add to `.env`:

```env
# Service Configuration
SERVICE_NAME=eduos-api
APP_VERSION=1.0.0
LOG_LEVEL=info

# Prometheus Metrics
METRICS_ENABLED=true

# Jaeger Tracing
JAEGER_AGENT_HOST=localhost
JAEGER_AGENT_PORT=6831
JAEGER_SAMPLER_TYPE=probabilistic
JAEGER_SAMPLER_PARAM=0.1

# Logstash
LOGSTASH_ENABLED=true
LOGSTASH_HOST=localhost
LOGSTASH_PORT=5000

# Alertmanager
SMTP_PASSWORD=your_smtp_password
SLACK_WEBHOOK_URL=your_slack_webhook
PAGERDUTY_SERVICE_KEY=your_pagerduty_key
```

### 4. Integrate Middleware in Application

Update `src/server.js`:

```javascript
const express = require('express');
const { metricsMiddleware, metricsHandler } = require('./middleware/metricsMiddleware');
const { tracingMiddleware, initializeTracer } = require('./middleware/tracingMiddleware');
const { loggingMiddleware, errorLoggingMiddleware } = require('./middleware/loggingMiddleware');

const app = express();

// Initialize Jaeger tracer
initializeTracer('eduos-api');

// Apply middleware
app.use(loggingMiddleware);
app.use(tracingMiddleware);
app.use(metricsMiddleware);

// Your routes here
// ...

// Metrics endpoint
app.get('/metrics', metricsHandler);

// Error logging
app.use(errorLoggingMiddleware);

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Alert Rules

### System Alerts

| Alert | Threshold | Duration | Severity |
|-------|-----------|----------|----------|
| High CPU Usage | > 80% | 5 min | Warning |
| Critical CPU Usage | > 95% | 2 min | Critical |
| High Memory Usage | > 90% | 5 min | Warning |
| Critical Memory Usage | > 95% | 2 min | Critical |
| High Disk Usage | > 85% | 10 min | Warning |
| Instance Down | N/A | 1 min | Critical |

### Application Alerts

| Alert | Threshold | Duration | Severity |
|-------|-----------|----------|----------|
| High Error Rate | > 1% | 5 min | Warning |
| Critical Error Rate | > 5% | 2 min | Critical |
| High API Latency (P95) | > 500ms | 5 min | Warning |
| Critical API Latency (P95) | > 2s | 2 min | Critical |
| DB Connection Pool | > 80% | 5 min | Warning |
| Low Cache Hit Rate | < 95% | 10 min | Warning |

## Dashboards

### System Health Dashboard

**Panels**:
1. CPU Usage (by instance)
2. Memory Usage (by instance)
3. Disk Usage (by mountpoint)
4. Network Traffic (RX/TX)

**Alerts**: CPU > 80%, Memory > 90%

### API Performance Dashboard

**Panels**:
1. Request Rate (by service)
2. Error Rate (by service)
3. API Latency (P50, P95, P99)
4. Requests by Status Code
5. Database Connection Pool
6. Redis Cache Hit Rate

**Alerts**: Error Rate > 1%

## Usage Examples

### Recording Custom Metrics

```javascript
const { recordStudentEnrollment, recordPayment } = require('./middleware/metricsMiddleware');

// Record a student enrollment
recordStudentEnrollment('tenant-123', 'Computer Science');

// Record a payment
recordPayment('tenant-123', 'success', 'stripe');
```

### Adding Distributed Tracing

```javascript
const { traceDbQuery, traceHttpCall } = require('./middleware/tracingMiddleware');

// Trace a database query
app.get('/students', async (req, res) => {
  const result = await traceDbQuery(
    req.span,
    'SELECT * FROM students WHERE tenant_id = $1',
    [req.tenantId],
    async () => {
      return await db.query('SELECT * FROM students WHERE tenant_id = $1', [req.tenantId]);
    }
  );
  
  res.json(result.rows);
});

// Trace an HTTP call to AI service
const aiResult = await traceHttpCall(
  req.span,
  'POST',
  'http://ai-service:8000/inference',
  async (headers) => {
    return await axios.post('http://ai-service:8000/inference', data, { headers });
  }
);
```

### Structured Logging

```javascript
const { logInfo, logError, logAudit } = require('./middleware/loggingMiddleware');

// Log an info message
logInfo('Student enrolled successfully', {
  tenantId: 'tenant-123',
  studentId: 'student-456',
  program: 'Computer Science',
});

// Log an error
try {
  // Some operation
} catch (error) {
  logError('Failed to process payment', error, {
    tenantId: 'tenant-123',
    transactionId: 'txn-789',
  });
}

// Log an audit event
logAudit('user.login', {
  userId: 'user-123',
  tenantId: 'tenant-456',
  ip: req.ip,
});
```

## Troubleshooting

### Prometheus Not Scraping Metrics

1. Check if the application is exposing metrics:
   ```bash
   curl http://localhost:3000/metrics
   ```

2. Verify Prometheus targets:
   - Go to http://localhost:9090/targets
   - Check if targets are "UP"

3. Check Prometheus logs:
   ```bash
   docker-compose logs prometheus
   ```

### Grafana Dashboards Not Loading

1. Verify Prometheus datasource:
   - Go to Configuration → Data Sources
   - Test the Prometheus connection

2. Check Grafana logs:
   ```bash
   docker-compose logs grafana
   ```

### Jaeger Not Receiving Traces

1. Verify Jaeger agent is accessible:
   ```bash
   telnet localhost 6831
   ```

2. Check application environment variables:
   ```bash
   echo $JAEGER_AGENT_HOST
   echo $JAEGER_AGENT_PORT
   ```

3. Check Jaeger logs:
   ```bash
   docker-compose logs jaeger
   ```

### Logs Not Appearing in Kibana

1. Verify Logstash is receiving logs:
   ```bash
   docker-compose logs logstash
   ```

2. Check Elasticsearch indices:
   ```bash
   curl http://localhost:9200/_cat/indices?v
   ```

3. Create index pattern in Kibana:
   - Go to Management → Index Patterns
   - Create pattern: `eduos-logs-*`
   - Select `@timestamp` as time field

## Maintenance

### Data Retention

**Prometheus**:
- Default retention: 15 days
- Configure in `prometheus.yml`: `--storage.tsdb.retention.time=30d`

**Elasticsearch**:
- Implement Index Lifecycle Management (ILM)
- Rotate indices daily
- Delete old indices after 30 days

### Backup

**Prometheus**:
```bash
# Backup Prometheus data
docker cp eduos_prometheus:/prometheus ./backups/prometheus-$(date +%Y%m%d)
```

**Grafana**:
```bash
# Backup Grafana dashboards
docker cp eduos_grafana:/var/lib/grafana ./backups/grafana-$(date +%Y%m%d)
```

**Elasticsearch**:
```bash
# Create snapshot repository
curl -X PUT "localhost:9200/_snapshot/backup" -H 'Content-Type: application/json' -d'
{
  "type": "fs",
  "settings": {
    "location": "/usr/share/elasticsearch/backup"
  }
}'

# Create snapshot
curl -X PUT "localhost:9200/_snapshot/backup/snapshot_$(date +%Y%m%d)"
```

## Performance Tuning

### Prometheus

- Adjust scrape interval based on needs (default: 15s)
- Increase retention for long-term analysis
- Use recording rules for expensive queries

### Elasticsearch

- Increase heap size for better performance:
  ```yaml
  environment:
    - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
  ```
- Enable index lifecycle management
- Use hot-warm-cold architecture for large deployments

### Jaeger

- Adjust sampling rate based on traffic:
  - Development: 100% (param: 1.0)
  - Staging: 50% (param: 0.5)
  - Production: 10% (param: 0.1)

## Security

### Authentication

- Change default Grafana credentials immediately
- Enable authentication for Prometheus and Alertmanager
- Use TLS for all external connections

### Network Security

- Restrict access to monitoring ports
- Use firewall rules or security groups
- Consider VPN for remote access

### Data Privacy

- Sanitize sensitive data in logs
- Implement field-level encryption for PII
- Configure data retention policies

## Support

For issues or questions:
- Check logs: `docker-compose logs <service>`
- Review documentation: `monitoring/README.md`
- Contact: ops-team@eduos.platform

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Elasticsearch Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [EduOS Architecture](../docs/ARCHITECTURE.md)
