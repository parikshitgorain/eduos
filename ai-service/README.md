# EduOS AI Inference Service

FastAPI microservice for AI-powered advisory features in the EduOS platform.

## Overview

This service provides AI-powered capabilities including:
- Duplicate student detection (semantic embeddings)
- Academic risk prediction
- Attendance anomaly detection
- Schedule optimization

**Important:** This service operates in **ADVISORY MODE ONLY**. It is isolated from the System of Record and has no direct database write access. All AI outputs require human approval before any data modifications.

### AI Governance Framework

The service implements a comprehensive governance framework:

1. **Confidence Scoring:** All AI outputs tagged with confidence scores (0.0 - 1.0)
2. **Explainability:** SHAP values, reason codes, and feature importance included
3. **Human-in-the-Loop (HITL):** Critical operations require human approval
4. **AI Kill Switch:** SuperAdmin can disable all AI services globally
5. **Audit Logging:** All AI predictions and human decisions recorded

## Technology Stack

- **Python:** 3.11+
- **Framework:** FastAPI
- **ML Libraries:**
  - scikit-learn (Isolation Forest, Logistic Regression)
  - XGBoost (Academic Risk Prediction)
  - sentence-transformers (SBERT for semantic embeddings)
  - SHAP (Explainability)

## Quick Start

### Using Docker (Recommended)

```bash
# Build and run the service
docker-compose up --build

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

### Local Development

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Unix/MacOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the service
python main.py

# Or use uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation

Once the service is running, access:

- **Interactive API Docs (Swagger UI):** http://localhost:8000/docs
- **Alternative API Docs (ReDoc):** http://localhost:8000/redoc
- **OpenAPI JSON Spec:** http://localhost:8000/openapi.json

### Key Endpoints

#### Governance Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/recommendations` | POST | Create AI recommendation with governance metadata |
| `/api/v1/recommendations/{id}` | GET | Get recommendation by ID |
| `/api/v1/approvals` | POST | Human approval of AI recommendation (HITL) |
| `/api/v1/approvals/{id}` | GET | Get approval details |
| `/api/v1/kill-switch` | GET | Get AI Kill Switch status |
| `/api/v1/kill-switch` | POST | Toggle AI Kill Switch (SuperAdmin only) |
| `/api/v1/audit-logs` | GET | Get audit logs for AI predictions and decisions |

#### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with dependency status |
| `/` | GET | Service information |

## Health Check

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

## Architecture

This service is part of the EduOS microservices architecture:

```
┌─────────────────────────────────────────┐
│     System of Record (Node.js/Go)      │
│  (Authoritative, Transactional, ACID)  │
└──────────────┬──────────────────────────┘
               │
               │ HTTP API Calls
               │ (Advisory Requests)
               ▼
┌─────────────────────────────────────────┐
│   AI Inference Service (Python/FastAPI) │
│    (Advisory, Non-Authoritative)        │
│                                         │
│  • Duplicate Detection                  │
│  • Risk Scoring                         │
│  • Anomaly Detection                    │
│  • Explainability (SHAP)                │
└─────────────────────────────────────────┘
```

## Security & Governance

1. **No Database Access:** This service has no direct database credentials
2. **Advisory Only:** All outputs are recommendations, not decisions
3. **Human-in-the-Loop:** Critical operations require human approval
4. **Explainability:** All predictions include confidence scores and reason codes
5. **AI Kill Switch:** Can be disabled globally by SuperAdmin

## Development

### Project Structure

```
ai-service/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── Dockerfile             # Container definition
├── docker-compose.yml     # Docker orchestration
├── .env.example           # Environment variables template
└── README.md              # This file
```

### Adding New Endpoints

1. Define Pydantic models for request/response
2. Add endpoint to `main.py` with proper tags
3. Include explainability metadata in responses
4. Update API documentation

### Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

## Deployment

### Production Considerations

1. **Environment Variables:** Configure `.env` file properly
2. **CORS:** Restrict `ALLOWED_ORIGINS` to specific domains
3. **Scaling:** Use Kubernetes HPA for auto-scaling
4. **Monitoring:** Integrate with Prometheus/Grafana
5. **Logging:** Configure structured logging to ELK stack

### Docker Build

```bash
# Build image
docker build -t eduos-ai-service:1.0.0 .

# Run container
docker run -p 8000:8000 eduos-ai-service:1.0.0
```

## License

Copyright © 2026 EduOS Platform
