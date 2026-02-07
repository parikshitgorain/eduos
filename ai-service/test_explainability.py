"""
Tests for AI Explainability Dashboard
Task 3.4.2: Implement AI explainability dashboard
"""

import pytest
from datetime import datetime, timezone, timedelta
from explainability import ExplainabilityDashboard


@pytest.fixture
def dashboard():
    """Create a fresh dashboard instance for each test"""
    return ExplainabilityDashboard()


@pytest.fixture
def sample_predictions(dashboard):
    """Create sample predictions for testing"""
    # Record predictions with various characteristics
    predictions = [
        {
            'model_name': 'duplicate-detector',
            'prediction': 'duplicate',
            'confidence_score': 0.95,
            'actual_outcome': 'duplicate',
            'demographic_group': 'gender',
            'demographic_value': 'male',
            'shap_values': {'name_similarity': 0.8, 'dob_match': 0.6, 'address_similarity': 0.4},
            'feature_importance': {'name_similarity': 0.8, 'dob_match': 0.6, 'address_similarity': 0.4}
        },
        {
            'model_name': 'duplicate-detector',
            'prediction': 'not_duplicate',
            'confidence_score': 0.75,
            'actual_outcome': 'not_duplicate',
            'demographic_group': 'gender',
            'demographic_value': 'female',
            'shap_values': {'name_similarity': 0.3, 'dob_match': 0.2, 'address_similarity': 0.1},
            'feature_importance': {'name_similarity': 0.3, 'dob_match': 0.2, 'address_similarity': 0.1}
        },
        {
            'model_name': 'duplicate-detector',
            'prediction': 'duplicate',
            'confidence_score': 0.88,
            'actual_outcome': 'duplicate',
            'demographic_group': 'gender',
            'demographic_value': 'male',
            'shap_values': {'name_similarity': 0.7, 'dob_match': 0.5, 'address_similarity': 0.3},
            'feature_importance': {'name_similarity': 0.7, 'dob_match': 0.5, 'address_similarity': 0.3}
        },
        {
            'model_name': 'duplicate-detector',
            'prediction': 'not_duplicate',
            'confidence_score': 0.65,
            'actual_outcome': 'duplicate',  # Incorrect prediction
            'demographic_group': 'gender',
            'demographic_value': 'female',
            'shap_values': {'name_similarity': 0.4, 'dob_match': 0.3, 'address_similarity': 0.2},
            'feature_importance': {'name_similarity': 0.4, 'dob_match': 0.3, 'address_similarity': 0.2}
        },
        {
            'model_name': 'risk-predictor',
            'prediction': 'high_risk',
            'confidence_score': 0.92,
            'actual_outcome': 'high_risk',
            'demographic_group': 'age_group',
            'demographic_value': '18-25',
            'shap_values': {'attendance_rate': 0.9, 'assignment_latency': 0.7, 'login_frequency': 0.5},
            'feature_importance': {'attendance_rate': 0.9, 'assignment_latency': 0.7, 'login_frequency': 0.5}
        }
    ]
    
    for pred in predictions:
        dashboard.record_prediction(**pred)
    
    return predictions


class TestExplainabilityDashboard:
    """Test suite for ExplainabilityDashboard"""
    
    def test_dashboard_initialization(self, dashboard):
        """Test dashboard initializes correctly"""
        assert dashboard is not None
        assert dashboard.predictions == []
        assert dashboard.fairness_metrics == []
    
    def test_record_prediction(self, dashboard):
        """Test recording a prediction"""
        dashboard.record_prediction(
            model_name='test-model',
            prediction='positive',
            confidence_score=0.85,
            actual_outcome='positive',
            demographic_group='gender',
            demographic_value='male',
            shap_values={'feature1': 0.5, 'feature2': 0.3},
            feature_importance={'feature1': 0.5, 'feature2': 0.3}
        )
        
        assert len(dashboard.predictions) == 1
        assert dashboard.predictions[0]['model_name'] == 'test-model'
        assert dashboard.predictions[0]['confidence_score'] == 0.85
        assert len(dashboard.fairness_metrics) == 1
    
    def test_get_model_accuracy(self, dashboard, sample_predictions):
        """Test model accuracy calculation"""
        accuracy = dashboard.get_model_accuracy('duplicate-detector', time_range_days=7)
        
        assert accuracy['model_name'] == 'duplicate-detector'
        assert accuracy['total_predictions'] == 4  # 4 duplicate-detector predictions
        assert accuracy['correct_predictions'] == 3  # 3 correct predictions
        assert accuracy['accuracy'] == 0.75  # 75% accuracy
        assert accuracy['accuracy_percentage'] == 75.0
    
    def test_get_model_accuracy_no_data(self, dashboard):
        """Test accuracy with no predictions"""
        accuracy = dashboard.get_model_accuracy('nonexistent-model', time_range_days=7)
        
        assert accuracy['total_predictions'] == 0
        assert accuracy['accuracy'] is None
        assert 'message' in accuracy
    
    def test_get_confidence_distribution(self, dashboard, sample_predictions):
        """Test confidence distribution calculation"""
        distribution = dashboard.get_confidence_distribution('duplicate-detector', time_range_days=7, num_bins=10)
        
        assert distribution['model_name'] == 'duplicate-detector'
        assert distribution['total_predictions'] == 4
        assert 0 <= distribution['avg_confidence'] <= 1
        assert 0 <= distribution['median_confidence'] <= 1
        assert len(distribution['distribution']) == 10  # 10 bins
        
        # Check that all predictions are counted
        total_count = sum(bin_data['count'] for bin_data in distribution['distribution'])
        assert total_count == 4
    
    def test_get_bias_metrics(self, dashboard, sample_predictions):
        """Test bias metrics calculation"""
        bias_metrics = dashboard.get_bias_metrics('duplicate-detector', time_range_days=7)
        
        assert bias_metrics['model_name'] == 'duplicate-detector'
        assert 'bias_detected' in bias_metrics
        assert 'demographic_analysis' in bias_metrics
        
        # Check demographic analysis
        analysis = bias_metrics['demographic_analysis']
        assert len(analysis) > 0
        
        # Find gender group
        gender_group = next((g for g in analysis if g['demographic_group'] == 'gender'), None)
        assert gender_group is not None
        assert len(gender_group['metrics_by_value']) == 2  # male and female
    
    def test_bias_detection_threshold(self, dashboard):
        """Test bias detection with significant accuracy variance"""
        # Record predictions with significant bias
        # Male group: 100% accuracy
        for i in range(10):
            dashboard.record_prediction(
                model_name='biased-model',
                prediction='positive',
                confidence_score=0.9,
                actual_outcome='positive',
                demographic_group='gender',
                demographic_value='male'
            )
        
        # Female group: 50% accuracy
        for i in range(10):
            outcome = 'positive' if i < 5 else 'negative'
            dashboard.record_prediction(
                model_name='biased-model',
                prediction='positive',
                confidence_score=0.9,
                actual_outcome=outcome,
                demographic_group='gender',
                demographic_value='female'
            )
        
        bias_metrics = dashboard.get_bias_metrics('biased-model', time_range_days=7)
        
        # Should detect bias (50% variance > 10% threshold)
        assert bias_metrics['bias_detected'] is True
        
        gender_group = next(
            (g for g in bias_metrics['demographic_analysis'] if g['demographic_group'] == 'gender'),
            None
        )
        assert gender_group is not None
        assert gender_group['bias_detected'] is True
        assert gender_group['accuracy_variance'] > 0.1
    
    def test_get_shap_summary(self, dashboard, sample_predictions):
        """Test SHAP values summary"""
        shap_summary = dashboard.get_shap_summary('duplicate-detector', time_range_days=7, top_n=5)
        
        assert shap_summary['model_name'] == 'duplicate-detector'
        assert shap_summary['total_predictions_analyzed'] == 4
        assert 'top_features' in shap_summary
        
        # Check that features are sorted by importance
        top_features = shap_summary['top_features']
        assert len(top_features) > 0
        
        # Verify features are sorted (descending)
        importances = [f['avg_importance'] for f in top_features]
        assert importances == sorted(importances, reverse=True)
    
    def test_get_shap_summary_no_data(self, dashboard):
        """Test SHAP summary with no data"""
        shap_summary = dashboard.get_shap_summary('nonexistent-model', time_range_days=7)
        
        assert 'message' in shap_summary
        assert shap_summary['message'] == 'No SHAP values available for this model'
    
    def test_get_historical_trends(self, dashboard, sample_predictions):
        """Test historical trends calculation"""
        trends = dashboard.get_historical_trends('duplicate-detector', days=7, interval_days=1)
        
        assert trends['model_name'] == 'duplicate-detector'
        assert trends['days'] == 7
        assert trends['interval_days'] == 1
        assert 'data_points' in trends
        
        # Check data points structure
        if trends['data_points']:
            for point in trends['data_points']:
                assert 'start_date' in point
                assert 'end_date' in point
                assert 'total_predictions' in point
                assert 'avg_confidence' in point
    
    def test_generate_dashboard_summary(self, dashboard, sample_predictions):
        """Test comprehensive dashboard summary generation"""
        summary = dashboard.generate_dashboard_summary('duplicate-detector', time_range_days=7)
        
        assert summary['model_name'] == 'duplicate-detector'
        assert summary['time_range_days'] == 7
        assert 'generated_at' in summary
        assert 'accuracy_metrics' in summary
        assert 'confidence_distribution' in summary
        assert 'bias_metrics' in summary
        assert 'shap_summary' in summary
        assert 'historical_trends' in summary
        
        # Verify all sections have data
        assert summary['accuracy_metrics']['total_predictions'] > 0
        assert summary['confidence_distribution']['total_predictions'] > 0
    
    def test_export_dashboard_report_json(self, dashboard, sample_predictions):
        """Test dashboard report export in JSON format"""
        report = dashboard.export_dashboard_report('duplicate-detector', time_range_days=7, format='json')
        
        assert 'model_name' in report
        assert 'accuracy_metrics' in report
        assert 'confidence_distribution' in report
        assert 'bias_metrics' in report
    
    def test_export_dashboard_report_summary(self, dashboard, sample_predictions):
        """Test dashboard report export in summary format"""
        report = dashboard.export_dashboard_report('duplicate-detector', time_range_days=7, format='summary')
        
        assert 'report_id' in report
        assert 'model_name' in report
        assert 'report_date' in report
        assert 'summary' in report
        assert 'full_data' in report
        
        # Check summary fields
        summary = report['summary']
        assert 'model_accuracy' in summary
        assert 'bias_detected' in summary
        assert 'total_predictions' in summary
        assert 'avg_confidence' in summary
    
    def test_time_range_filtering(self, dashboard):
        """Test that time range filtering works correctly"""
        # Record old prediction (outside time range)
        old_time = datetime.now(timezone.utc) - timedelta(days=10)
        dashboard.predictions.append({
            'prediction_id': 'old_pred',
            'model_name': 'test-model',
            'prediction': 'positive',
            'confidence_score': 0.5,
            'actual_outcome': 'positive',
            'demographic_group': None,
            'demographic_value': None,
            'shap_values': None,
            'feature_importance': None,
            'timestamp': old_time
        })
        
        # Record recent prediction (within time range)
        dashboard.record_prediction(
            model_name='test-model',
            prediction='positive',
            confidence_score=0.9,
            actual_outcome='positive'
        )
        
        # Query with 7-day range should only include recent prediction
        accuracy = dashboard.get_model_accuracy('test-model', time_range_days=7)
        assert accuracy['total_predictions'] == 1
        
        # Query with 30-day range should include both
        accuracy_30 = dashboard.get_model_accuracy('test-model', time_range_days=30)
        assert accuracy_30['total_predictions'] == 2
    
    def test_multiple_models(self, dashboard, sample_predictions):
        """Test dashboard handles multiple models correctly"""
        # Get metrics for duplicate-detector
        dup_accuracy = dashboard.get_model_accuracy('duplicate-detector', time_range_days=7)
        assert dup_accuracy['total_predictions'] == 4
        
        # Get metrics for risk-predictor
        risk_accuracy = dashboard.get_model_accuracy('risk-predictor', time_range_days=7)
        assert risk_accuracy['total_predictions'] == 1
        
        # Verify they don't interfere with each other
        assert dup_accuracy['model_name'] != risk_accuracy['model_name']
    
    def test_confidence_distribution_bins(self, dashboard):
        """Test confidence distribution with different bin sizes"""
        # Record predictions with known confidence scores
        for score in [0.1, 0.3, 0.5, 0.7, 0.9]:
            dashboard.record_prediction(
                model_name='test-model',
                prediction='positive',
                confidence_score=score
            )
        
        # Test with 5 bins
        dist_5 = dashboard.get_confidence_distribution('test-model', time_range_days=7, num_bins=5)
        assert len(dist_5['distribution']) == 5
        
        # Test with 10 bins
        dist_10 = dashboard.get_confidence_distribution('test-model', time_range_days=7, num_bins=10)
        assert len(dist_10['distribution']) == 10
    
    def test_shap_feature_aggregation(self, dashboard):
        """Test SHAP values are correctly aggregated across predictions"""
        # Record predictions with consistent SHAP values
        for i in range(3):
            dashboard.record_prediction(
                model_name='test-model',
                prediction='positive',
                confidence_score=0.8,
                shap_values={'feature_a': 0.5, 'feature_b': 0.3, 'feature_c': 0.1}
            )
        
        shap_summary = dashboard.get_shap_summary('test-model', time_range_days=7, top_n=3)
        
        assert len(shap_summary['top_features']) == 3
        
        # Verify features are in correct order
        features = [f['feature'] for f in shap_summary['top_features']]
        assert features[0] == 'feature_a'  # Highest importance
        assert features[1] == 'feature_b'
        assert features[2] == 'feature_c'  # Lowest importance


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
