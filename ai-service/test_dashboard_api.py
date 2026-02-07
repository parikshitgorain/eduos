"""
Integration tests for AI Explainability Dashboard API endpoints
Task 3.4.2: Implement AI explainability dashboard
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from explainability import get_explainability_dashboard


@pytest.fixture
def client():
    """Create a test client"""
    return TestClient(app)


@pytest.fixture
def dashboard_with_data():
    """Create dashboard with sample data"""
    dashboard = get_explainability_dashboard()
    
    # Clear any existing data
    dashboard.predictions = []
    dashboard.fairness_metrics = []
    
    # Add sample predictions
    for i in range(10):
        dashboard.record_prediction(
            model_name='duplicate-detector',
            prediction='duplicate' if i % 2 == 0 else 'not_duplicate',
            confidence_score=0.7 + (i * 0.02),
            actual_outcome='duplicate' if i % 2 == 0 else 'not_duplicate',
            demographic_group='gender',
            demographic_value='male' if i % 2 == 0 else 'female',
            shap_values={
                'name_similarity': 0.5 + (i * 0.01),
                'dob_match': 0.3 + (i * 0.01),
                'address_similarity': 0.2 + (i * 0.01)
            },
            feature_importance={
                'name_similarity': 0.5 + (i * 0.01),
                'dob_match': 0.3 + (i * 0.01),
                'address_similarity': 0.2 + (i * 0.01)
            }
        )
    
    return dashboard


class TestDashboardAPI:
    """Test suite for dashboard API endpoints"""
    
    def test_health_check(self, client):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        assert 'dependencies' in data
    
    def test_get_model_accuracy(self, client, dashboard_with_data):
        """Test GET /api/v1/dashboard/accuracy/{model_name}"""
        response = client.get("/api/v1/dashboard/accuracy/duplicate-detector?time_range_days=7")
        assert response.status_code == 200
        
        data = response.json()
        assert data['model_name'] == 'duplicate-detector'
        assert data['total_predictions'] == 10
        assert data['accuracy'] == 1.0  # All predictions are correct
        assert data['accuracy_percentage'] == 100.0
    
    def test_get_model_accuracy_no_data(self, client, dashboard_with_data):
        """Test accuracy endpoint with non-existent model"""
        response = client.get("/api/v1/dashboard/accuracy/nonexistent-model?time_range_days=7")
        assert response.status_code == 200
        
        data = response.json()
        assert data['total_predictions'] == 0
        assert data['accuracy'] is None
        assert 'message' in data
    
    def test_get_confidence_distribution(self, client, dashboard_with_data):
        """Test GET /api/v1/dashboard/confidence/{model_name}"""
        response = client.get("/api/v1/dashboard/confidence/duplicate-detector?time_range_days=7&num_bins=10")
        assert response.status_code == 200
        
        data = response.json()
        assert data['model_name'] == 'duplicate-detector'
        assert data['total_predictions'] == 10
        assert 'avg_confidence' in data
        assert 'median_confidence' in data
        assert len(data['distribution']) == 10
    
    def test_get_bias_metrics(self, client, dashboard_with_data):
        """Test GET /api/v1/dashboard/bias/{model_name}"""
        response = client.get("/api/v1/dashboard/bias/duplicate-detector?time_range_days=7")
        assert response.status_code == 200
        
        data = response.json()
        assert data['model_name'] == 'duplicate-detector'
        assert 'bias_detected' in data
        assert 'demographic_analysis' in data
        
        # Should have gender analysis
        if data['demographic_analysis']:
            gender_group = next(
                (g for g in data['demographic_analysis'] if g['demographic_group'] == 'gender'),
                None
            )
            assert gender_group is not None
    
    def test_get_shap_summary(self, client, dashboard_with_data):
        """Test GET /api/v1/dashboard/shap/{model_name}"""
        response = client.get("/api/v1/dashboard/shap/duplicate-detector?time_range_days=7&top_n=5")
        assert response.status_code == 200
        
        data = response.json()
        assert data['model_name'] == 'duplicate-detector'
        assert data['total_predictions_analyzed'] == 10
        assert 'top_features' in data
        assert len(data['top_features']) > 0
        
        # Verify features are sorted by importance
        importances = [f['avg_importance'] for f in data['top_features']]
        assert importances == sorted(importances, reverse=True)
    
    def test_get_historical_trends(self, client, dashboard_with_data):
        """Test GET /api/v1/dashboard/trends/{model_name}"""
        response = client.get("/api/v1/dashboard/trends/duplicate-detector?days=7&interval_days=1")
        assert response.status_code == 200
        
        data = response.json()
        assert data['model_name'] == 'duplicate-detector'
        assert data['days'] == 7
        assert 'data_points' in data
    
    def test_get_dashboard_summary(self, client, dashboard_with_data):
        """Test POST /api/v1/dashboard/summary"""
        response = client.post(
            "/api/v1/dashboard/summary",
            json={
                "model_name": "duplicate-detector",
                "time_range_days": 7
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data['model_name'] == 'duplicate-detector'
        assert data['time_range_days'] == 7
        assert 'generated_at' in data
        assert 'accuracy_metrics' in data
        assert 'confidence_distribution' in data
        assert 'bias_metrics' in data
        assert 'shap_summary' in data
        assert 'historical_trends' in data
    
    def test_export_dashboard_report_json(self, client, dashboard_with_data):
        """Test GET /api/v1/dashboard/export/{model_name} with JSON format"""
        response = client.get("/api/v1/dashboard/export/duplicate-detector?time_range_days=7&format=json")
        assert response.status_code == 200
        
        data = response.json()
        assert 'model_name' in data
        assert 'accuracy_metrics' in data
        assert 'confidence_distribution' in data
    
    def test_export_dashboard_report_summary(self, client, dashboard_with_data):
        """Test GET /api/v1/dashboard/export/{model_name} with summary format"""
        response = client.get("/api/v1/dashboard/export/duplicate-detector?time_range_days=7&format=summary")
        assert response.status_code == 200
        
        data = response.json()
        assert 'report_id' in data
        assert 'model_name' in data
        assert 'report_date' in data
        assert 'summary' in data
        assert 'full_data' in data
        
        # Check summary structure
        summary = data['summary']
        assert 'model_accuracy' in summary
        assert 'bias_detected' in summary
        assert 'total_predictions' in summary
        assert 'avg_confidence' in summary
    
    def test_invalid_time_range(self, client, dashboard_with_data):
        """Test with invalid time range parameter"""
        response = client.get("/api/v1/dashboard/accuracy/duplicate-detector?time_range_days=0")
        assert response.status_code == 422  # Validation error
    
    def test_invalid_format(self, client, dashboard_with_data):
        """Test export with invalid format"""
        response = client.get("/api/v1/dashboard/export/duplicate-detector?format=invalid")
        assert response.status_code == 422  # Validation error
    
    def test_openapi_docs(self, client):
        """Test that OpenAPI documentation is available"""
        response = client.get("/docs")
        assert response.status_code == 200
        
        # Check OpenAPI spec
        response = client.get("/openapi.json")
        assert response.status_code == 200
        spec = response.json()
        
        # Verify dashboard endpoints are documented
        assert '/api/v1/dashboard/accuracy/{model_name}' in spec['paths']
        assert '/api/v1/dashboard/confidence/{model_name}' in spec['paths']
        assert '/api/v1/dashboard/bias/{model_name}' in spec['paths']
        assert '/api/v1/dashboard/shap/{model_name}' in spec['paths']
        assert '/api/v1/dashboard/trends/{model_name}' in spec['paths']
        assert '/api/v1/dashboard/summary' in spec['paths']
        assert '/api/v1/dashboard/export/{model_name}' in spec['paths']


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
