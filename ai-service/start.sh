#!/bin/bash

# EduOS AI Inference Service Startup Script

echo "Starting EduOS AI Inference Service..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install/update dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Run the service
echo "Starting FastAPI service..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
