# Quick Start Guide - EduOS AI Inference Service

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Python 3.10+ installed
- Internet connection (for downloading dependencies)

### Step 1: Navigate to Service Directory
```bash
cd ai-service
```

### Step 2: Setup Virtual Environment

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

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Start the Service
```bash
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started server process
INFO:     Application startup complete.
```

### Step 5: Test the Service

Open your browser and visit:
- **API Documentation:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health

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

## 🐳 Docker Quick Start

### Option 1: Docker Compose (Recommended)
```bash
docker-compose up -d
```

### Option 2: Docker Build & Run
```bash
docker build -t eduos-ai-service:1.0.0 .
docker run -d -p 8000:8000 eduos-ai-service:1.0.0
```

### Verify Docker Deployment
```bash
curl http://localhost:8000/health
```

## 📚 Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service information |
| `/health` | GET | Health check with dependencies |
| `/docs` | GET | Interactive API documentation (Swagger UI) |
| `/redoc` | GET | Alternative API documentation (ReDoc) |
| `/openapi.json` | GET | OpenAPI 3.0 specification |

## 🧪 Run Tests

```bash
pytest test_main.py -v
```

Expected output:
```
test_main.py::test_root_endpoint PASSED
test_main.py::test_health_check PASSED
test_main.py::test_openapi_spec PASSED
test_main.py::test_docs_available PASSED
test_main.py::test_redoc_available PASSED

5 passed in 0.37s
```

## 🛑 Stop the Service

**Local Development:**
Press `CTRL+C` in the terminal

**Docker:**
```bash
docker-compose down
```

## 🔧 Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` to customize:
```bash
ENVIRONMENT=development
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=info
```

## 📖 Next Steps

1. **Read the Architecture:** See `ARCHITECTURE.md` for design details
2. **Deployment Guide:** See `DEPLOYMENT.md` for production setup
3. **Full Documentation:** See `README.md` for comprehensive guide

## ⚠️ Important Notes

- **No Database Access:** This service is isolated from the System of Record
- **Advisory Mode Only:** All AI outputs are recommendations, not decisions
- **Human Approval Required:** Critical operations need human approval
- **Stateless:** No persistent storage or sessions

## 🆘 Troubleshooting

### Port Already in Use
```bash
# Change port in .env or use:
uvicorn main:app --port 8001
```

### Dependencies Not Installing
```bash
# Upgrade pip first
pip install --upgrade pip
pip install -r requirements.txt
```

### Service Won't Start
```bash
# Check Python version (must be 3.10+)
python --version

# Check if port 8000 is available
netstat -an | grep 8000  # Unix/MacOS
netstat -an | findstr 8000  # Windows
```

## 📞 Support

- **Documentation:** http://localhost:8000/docs (when running)
- **Health Status:** http://localhost:8000/health
- **Logs:** Check terminal output or `docker logs eduos-ai-service`

---

**Ready to build AI-powered features? Start exploring the API at http://localhost:8000/docs** 🎉
