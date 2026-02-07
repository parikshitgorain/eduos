"""
Tests for AI Inference Service
"""

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_root_endpoint():
    """Test root endpoint returns service information"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "EduOS AI Inference Service"
    assert data["version"] == "1.0.0"
    assert data["status"] == "running"
    assert "documentation" in data
    assert "health" in data


def test_health_check():
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert data["version"] == "1.0.0"
    assert "dependencies" in data
    
    # Check dependencies
    deps = data["dependencies"]
    assert "scikit-learn" in deps
    assert "xgboost" in deps
    assert "sentence-transformers" in deps


def test_openapi_spec():
    """Test OpenAPI specification is available"""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    assert spec["info"]["title"] == "EduOS AI Inference Service"
    assert spec["info"]["version"] == "1.0.0"
    assert "paths" in spec
    assert "/health" in spec["paths"]


def test_docs_available():
    """Test API documentation is accessible"""
    response = client.get("/docs")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_redoc_available():
    """Test ReDoc documentation is accessible"""
    response = client.get("/redoc")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
