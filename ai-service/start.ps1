# EduOS AI Inference Service Startup Script (Windows PowerShell)

Write-Host "Starting EduOS AI Inference Service..." -ForegroundColor Green

# Check if virtual environment exists
if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

# Install/update dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

# Run the service
Write-Host "Starting FastAPI service..." -ForegroundColor Green
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
