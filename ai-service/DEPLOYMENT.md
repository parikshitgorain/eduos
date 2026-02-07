# EduOS AI Inference Service - Deployment Guide

## Prerequisites

- Python 3.10+ (Python 3.11+ recommended)
- Docker (optional, for containerized deployment)
- Docker Compose (optional)

## Local Development Setup

### 1. Clone and Navigate

```bash
cd ai-service
```

### 2. Create Virtual Environment

**Windows:**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Unix/MacOS:**
```bash
python -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env as needed
```

### 5. Run the Service

**Option A: Using Python directly**
```bash
python main.py
```

**Option B: Using Uvicorn**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Option C: Using startup scripts**

Windows:
```powershell
.\start.ps1
```

Unix/MacOS:
```bash
chmod +x start.sh
./start.sh
```

### 6. Verify Service

Open your browser and navigate to:
- **API Docs:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health
- **Root:** http://localhost:8000/

Or use curl:
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-07T...",
  "version": "1.0.0",
  "dependencies": {
    "scikit-learn": "v1.4.0",
    "xgboost": "v2.0.3",
    "sentence-transformers": "v2.3.1"
  }
}
```

## Docker Deployment

### 1. Build Docker Image

```bash
docker build -t eduos-ai-service:1.0.0 .
```

### 2. Run Container

```bash
docker run -d \
  --name eduos-ai-service \
  -p 8000:8000 \
  -e ENVIRONMENT=production \
  eduos-ai-service:1.0.0
```

### 3. Using Docker Compose

```bash
# Start service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop service
docker-compose down
```

### 4. Verify Container

```bash
# Check container status
docker ps

# Check logs
docker logs eduos-ai-service

# Test health endpoint
curl http://localhost:8000/health
```

## Kubernetes Deployment

### 1. Create Deployment YAML

```yaml
# ai-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-service
  labels:
    app: ai-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-service
  template:
    metadata:
      labels:
        app: ai-service
    spec:
      containers:
      - name: ai-service
        image: eduos-ai-service:1.0.0
        ports:
        - containerPort: 8000
        env:
        - name: ENVIRONMENT
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: ai-service
spec:
  selector:
    app: ai-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: LoadBalancer
```

### 2. Deploy to Kubernetes

```bash
# Apply deployment
kubectl apply -f ai-service-deployment.yaml

# Check deployment status
kubectl get deployments
kubectl get pods
kubectl get services

# View logs
kubectl logs -f deployment/ai-service

# Scale deployment
kubectl scale deployment ai-service --replicas=5
```

## Production Considerations

### 1. Environment Variables

Configure these in production:

```bash
ENVIRONMENT=production
LOG_LEVEL=info
ALLOWED_ORIGINS=https://yourdomain.com
HOST=0.0.0.0
PORT=8000
```

### 2. Security

- **CORS:** Restrict `ALLOWED_ORIGINS` to specific domains
- **HTTPS:** Use TLS/SSL certificates (Let's Encrypt)
- **Firewall:** Restrict access to port 8000
- **No Database Access:** Verify no database credentials are configured

### 3. Monitoring

**Prometheus Metrics:**
```python
# Add to requirements.txt
prometheus-fastapi-instrumentator==6.1.0

# Add to main.py
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app)
```

**Health Check Monitoring:**
```bash
# Add to monitoring system
curl -f http://localhost:8000/health || exit 1
```

### 4. Logging

Configure structured logging:

```python
import logging
import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module
        }
        return json.dumps(log_data)
```

### 5. Performance Tuning

**Uvicorn Workers:**
```bash
uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --loop uvloop \
  --http httptools
```

**Gunicorn with Uvicorn Workers:**
```bash
gunicorn main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
```

### 6. Auto-Scaling

**Kubernetes HPA:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Testing

### Unit Tests

```bash
pytest test_main.py -v
```

### Integration Tests

```bash
# Start service
python main.py &

# Run integration tests
pytest tests/integration/ -v

# Stop service
pkill -f "python main.py"
```

### Load Testing

```bash
# Install locust
pip install locust

# Run load test
locust -f tests/load_test.py --host http://localhost:8000
```

## Troubleshooting

### Service Won't Start

1. Check Python version: `python --version` (must be 3.10+)
2. Check dependencies: `pip list`
3. Check port availability: `netstat -an | grep 8000`
4. Check logs: `tail -f logs/app.log`

### Health Check Fails

1. Verify service is running: `curl http://localhost:8000/`
2. Check dependencies installation
3. Review logs for errors

### Docker Build Fails

1. Check Dockerfile syntax
2. Verify base image availability
3. Check network connectivity
4. Review build logs

### Performance Issues

1. Check resource usage: `docker stats` or `kubectl top pods`
2. Review logs for bottlenecks
3. Increase workers/replicas
4. Enable caching

## Maintenance

### Updating Dependencies

```bash
# Update requirements.txt
pip install --upgrade -r requirements.txt

# Freeze new versions
pip freeze > requirements.txt
```

### Database Migrations

**Note:** This service has NO database access by design. If you need to add database functionality, ensure it follows the advisory-only pattern.

### Backup and Recovery

Since this service is stateless:
- No data backup required
- Recovery = redeploy container/pod
- Configuration stored in version control

## Support

For issues or questions:
1. Check logs: `docker logs eduos-ai-service`
2. Review documentation: `/docs` endpoint
3. Check health status: `/health` endpoint
4. Contact DevOps team

## License

Copyright © 2026 EduOS Platform
