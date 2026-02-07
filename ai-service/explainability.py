"""
AI Explainability Dashboard Module
Task 3.4.2: Implement AI explainability dashboard

Provides:
- Model accuracy and performance metrics
- Confidence score distribution
- Bias monitoring across demographics
- SHAP value visualization
- Historical trend analysis
- Export functionality for compliance audits
"""

import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)


class ExplainabilityDashboard:
    """
    Dashboard for AI model explainability and fairness monitoring
    """
    
    def __init__(self):
        """Initialize the explainability dashboard"""
        # In-memory storage for demo (replace with database in production)
        self.predictions: List[Dict[str, Any]] = []
        self.fairness_metrics: List[Dict[str, Any]] = []
        logger.info("ExplainabilityDashboard initialized")
    
    def record_prediction(
        self,
        model_name: str,
        prediction: Any,
        confidence_score: float,
        actual_outcome: Optional[str] = None,
        demographic_group: Optional[str] = None,
        demographic_value: Optional[str] = None,
        shap_values: Optional[Dict[str, float]] = None,
        feature_importance: Optional[Dict[str, float]] = None
    ):
        """
        Record a prediction for dashboard analytics
        
        Args:
            model_name: Name of the AI model
            prediction: The prediction made
            confidence_score: Confidence score (0.0 - 1.0)
            actual_outcome: Actual outcome (for accuracy calculation)
            demographic_group: Demographic category (e.g., 'gender', 'age_group')
            demographic_value: Demographic value (e.g., 'male', '18-25')
            shap_values: SHAP feature importance values
            feature_importance: Feature importance scores
        """
        record = {
            'prediction_id': f"pred_{uuid.uuid4().hex[:12]}",
            'model_name': model_name,
            'prediction': prediction,
            'confidence_score': confidence_score,
            'actual_outcome': actual_outcome,
            'demographic_group': demographic_group,
            'demographic_value': demographic_value,
            'shap_values': shap_values,
            'feature_importance': feature_importance,
            'timestamp': datetime.now(timezone.utc)
        }
        
        self.predictions.append(record)
        
        # Record fairness metrics if demographics provided
        if demographic_group and demographic_value:
            self._record_fairness_metric(
                model_name=model_name,
                demographic_group=demographic_group,
                demographic_value=demographic_value,
                prediction=prediction,
                confidence_score=confidence_score,
                actual_outcome=actual_outcome
            )
    
    def _record_fairness_metric(
        self,
        model_name: str,
        demographic_group: str,
        demographic_value: str,
        prediction: Any,
        confidence_score: float,
        actual_outcome: Optional[str]
    ):
        """Record fairness metric for bias monitoring"""
        metric = {
            'metric_id': f"metric_{uuid.uuid4().hex[:12]}",
            'model_name': model_name,
            'demographic_group': demographic_group,
            'demographic_value': demographic_value,
            'prediction': prediction,
            'confidence_score': confidence_score,
            'actual_outcome': actual_outcome,
            'timestamp': datetime.now(timezone.utc)
        }
        
        self.fairness_metrics.append(metric)
    
    def get_model_accuracy(
        self,
        model_name: str,
        time_range_days: int = 7
    ) -> Dict[str, Any]:
        """
        Calculate model accuracy over time range
        
        Args:
            model_name: Name of the model
            time_range_days: Number of days to analyze
        
        Returns:
            Dictionary with accuracy metrics
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(days=time_range_days)
        
        # Filter predictions for this model and time range
        relevant_predictions = [
            p for p in self.predictions
            if p['model_name'] == model_name
            and p['timestamp'] >= cutoff_time
            and p['actual_outcome'] is not None
        ]
        
        if not relevant_predictions:
            return {
                'model_name': model_name,
                'time_range_days': time_range_days,
                'total_predictions': 0,
                'accuracy': None,
                'message': 'No predictions with actual outcomes in time range'
            }
        
        # Calculate accuracy
        correct_predictions = sum(
            1 for p in relevant_predictions
            if str(p['prediction']) == str(p['actual_outcome'])
        )
        
        total_predictions = len(relevant_predictions)
        accuracy = correct_predictions / total_predictions if total_predictions > 0 else 0
        
        return {
            'model_name': model_name,
            'time_range_days': time_range_days,
            'total_predictions': total_predictions,
            'correct_predictions': correct_predictions,
            'accuracy': round(accuracy, 4),
            'accuracy_percentage': round(accuracy * 100, 2)
        }
    
    def get_confidence_distribution(
        self,
        model_name: str,
        time_range_days: int = 7,
        num_bins: int = 10
    ) -> Dict[str, Any]:
        """
        Get confidence score distribution for a model
        
        Args:
            model_name: Name of the model
            time_range_days: Number of days to analyze
            num_bins: Number of bins for histogram
        
        Returns:
            Dictionary with confidence distribution
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(days=time_range_days)
        
        # Filter predictions
        relevant_predictions = [
            p for p in self.predictions
            if p['model_name'] == model_name
            and p['timestamp'] >= cutoff_time
        ]
        
        if not relevant_predictions:
            return {
                'model_name': model_name,
                'time_range_days': time_range_days,
                'total_predictions': 0,
                'distribution': [],
                'message': 'No predictions in time range'
            }
        
        # Extract confidence scores
        confidence_scores = [p['confidence_score'] for p in relevant_predictions]
        
        # Create histogram bins
        bin_edges = [i / num_bins for i in range(num_bins + 1)]
        bins = [{'min': bin_edges[i], 'max': bin_edges[i+1], 'count': 0} 
                for i in range(num_bins)]
        
        # Count predictions in each bin
        for score in confidence_scores:
            for i, bin_data in enumerate(bins):
                if bin_data['min'] <= score < bin_data['max'] or \
                   (i == num_bins - 1 and score == 1.0):  # Include 1.0 in last bin
                    bin_data['count'] += 1
                    break
        
        # Calculate statistics
        avg_confidence = statistics.mean(confidence_scores)
        median_confidence = statistics.median(confidence_scores)
        
        return {
            'model_name': model_name,
            'time_range_days': time_range_days,
            'total_predictions': len(relevant_predictions),
            'avg_confidence': round(avg_confidence, 4),
            'median_confidence': round(median_confidence, 4),
            'min_confidence': round(min(confidence_scores), 4),
            'max_confidence': round(max(confidence_scores), 4),
            'distribution': bins
        }
    
    def get_bias_metrics(
        self,
        model_name: str,
        time_range_days: int = 7
    ) -> Dict[str, Any]:
        """
        Calculate bias metrics across demographic groups
        
        Args:
            model_name: Name of the model
            time_range_days: Number of days to analyze
        
        Returns:
            Dictionary with bias metrics and fairness analysis
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(days=time_range_days)
        
        # Filter fairness metrics
        relevant_metrics = [
            m for m in self.fairness_metrics
            if m['model_name'] == model_name
            and m['timestamp'] >= cutoff_time
        ]
        
        if not relevant_metrics:
            return {
                'model_name': model_name,
                'time_range_days': time_range_days,
                'bias_detected': False,
                'message': 'No demographic data available for bias analysis'
            }
        
        # Group by demographic category
        demographic_groups = defaultdict(lambda: defaultdict(list))
        
        for metric in relevant_metrics:
            group = metric['demographic_group']
            value = metric['demographic_value']
            demographic_groups[group][value].append(metric)
        
        # Calculate metrics for each demographic group
        bias_analysis = []
        
        for group_name, values in demographic_groups.items():
            group_metrics = []
            
            for value_name, metrics in values.items():
                # Calculate accuracy for this demographic
                metrics_with_outcome = [m for m in metrics if m['actual_outcome'] is not None]
                
                if metrics_with_outcome:
                    correct = sum(
                        1 for m in metrics_with_outcome
                        if str(m['prediction']) == str(m['actual_outcome'])
                    )
                    accuracy = correct / len(metrics_with_outcome)
                else:
                    accuracy = None
                
                # Calculate average confidence
                avg_confidence = statistics.mean([m['confidence_score'] for m in metrics])
                
                group_metrics.append({
                    'demographic_value': value_name,
                    'total_predictions': len(metrics),
                    'accuracy': round(accuracy, 4) if accuracy is not None else None,
                    'avg_confidence': round(avg_confidence, 4)
                })
            
            # Calculate bias indicators
            accuracies = [m['accuracy'] for m in group_metrics if m['accuracy'] is not None]
            
            if len(accuracies) >= 2:
                max_accuracy = max(accuracies)
                min_accuracy = min(accuracies)
                accuracy_variance = max_accuracy - min_accuracy
                bias_detected = accuracy_variance > 0.1  # 10% threshold
            else:
                accuracy_variance = None
                bias_detected = False
            
            bias_analysis.append({
                'demographic_group': group_name,
                'metrics_by_value': group_metrics,
                'accuracy_variance': round(accuracy_variance, 4) if accuracy_variance is not None else None,
                'bias_detected': bias_detected,
                'recommendation': 'Review model training data and feature engineering' if bias_detected else 'No significant bias detected'
            })
        
        # Overall bias detection
        overall_bias_detected = any(group['bias_detected'] for group in bias_analysis)
        
        return {
            'model_name': model_name,
            'time_range_days': time_range_days,
            'bias_detected': overall_bias_detected,
            'demographic_analysis': bias_analysis,
            'total_predictions_analyzed': len(relevant_metrics)
        }
    
    def get_shap_summary(
        self,
        model_name: str,
        time_range_days: int = 7,
        top_n: int = 10
    ) -> Dict[str, Any]:
        """
        Get summary of SHAP values (feature importance)
        
        Args:
            model_name: Name of the model
            time_range_days: Number of days to analyze
            top_n: Number of top features to return
        
        Returns:
            Dictionary with SHAP value summary
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(days=time_range_days)
        
        # Filter predictions with SHAP values
        relevant_predictions = [
            p for p in self.predictions
            if p['model_name'] == model_name
            and p['timestamp'] >= cutoff_time
            and p['shap_values'] is not None
        ]
        
        if not relevant_predictions:
            return {
                'model_name': model_name,
                'time_range_days': time_range_days,
                'message': 'No SHAP values available for this model'
            }
        
        # Aggregate SHAP values across all predictions
        feature_importance_sum = defaultdict(float)
        feature_count = defaultdict(int)
        
        for pred in relevant_predictions:
            for feature, value in pred['shap_values'].items():
                feature_importance_sum[feature] += abs(value)
                feature_count[feature] += 1
        
        # Calculate average importance
        avg_importance = {
            feature: feature_importance_sum[feature] / feature_count[feature]
            for feature in feature_importance_sum
        }
        
        # Sort by importance
        sorted_features = sorted(
            avg_importance.items(),
            key=lambda x: x[1],
            reverse=True
        )[:top_n]
        
        return {
            'model_name': model_name,
            'time_range_days': time_range_days,
            'total_predictions_analyzed': len(relevant_predictions),
            'top_features': [
                {
                    'feature': feature,
                    'avg_importance': round(importance, 4)
                }
                for feature, importance in sorted_features
            ]
        }
    
    def get_historical_trends(
        self,
        model_name: str,
        days: int = 30,
        interval_days: int = 1
    ) -> Dict[str, Any]:
        """
        Get historical trends for model performance
        
        Args:
            model_name: Name of the model
            days: Number of days to analyze
            interval_days: Interval for data points (1 = daily, 7 = weekly)
        
        Returns:
            Dictionary with historical trend data
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(days=days)
        
        # Filter predictions
        relevant_predictions = [
            p for p in self.predictions
            if p['model_name'] == model_name
            and p['timestamp'] >= cutoff_time
        ]
        
        if not relevant_predictions:
            return {
                'model_name': model_name,
                'days': days,
                'message': 'No predictions in time range'
            }
        
        # Group predictions by time interval
        intervals = []
        current_time = cutoff_time
        end_time = datetime.now(timezone.utc)
        
        while current_time < end_time:
            interval_end = current_time + timedelta(days=interval_days)
            
            # Get predictions in this interval
            interval_predictions = [
                p for p in relevant_predictions
                if current_time <= p['timestamp'] < interval_end
            ]
            
            if interval_predictions:
                # Calculate metrics for this interval
                avg_confidence = statistics.mean([p['confidence_score'] for p in interval_predictions])
                
                # Calculate accuracy if outcomes available
                with_outcomes = [p for p in interval_predictions if p['actual_outcome'] is not None]
                if with_outcomes:
                    correct = sum(
                        1 for p in with_outcomes
                        if str(p['prediction']) == str(p['actual_outcome'])
                    )
                    accuracy = correct / len(with_outcomes)
                else:
                    accuracy = None
                
                intervals.append({
                    'start_date': current_time.isoformat(),
                    'end_date': interval_end.isoformat(),
                    'total_predictions': len(interval_predictions),
                    'avg_confidence': round(avg_confidence, 4),
                    'accuracy': round(accuracy, 4) if accuracy is not None else None
                })
            
            current_time = interval_end
        
        return {
            'model_name': model_name,
            'days': days,
            'interval_days': interval_days,
            'data_points': intervals
        }
    
    def generate_dashboard_summary(
        self,
        model_name: str,
        time_range_days: int = 7
    ) -> Dict[str, Any]:
        """
        Generate comprehensive dashboard summary
        
        Args:
            model_name: Name of the model
            time_range_days: Number of days to analyze
        
        Returns:
            Complete dashboard data
        """
        return {
            'model_name': model_name,
            'time_range_days': time_range_days,
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'accuracy_metrics': self.get_model_accuracy(model_name, time_range_days),
            'confidence_distribution': self.get_confidence_distribution(model_name, time_range_days),
            'bias_metrics': self.get_bias_metrics(model_name, time_range_days),
            'shap_summary': self.get_shap_summary(model_name, time_range_days),
            'historical_trends': self.get_historical_trends(model_name, days=time_range_days)
        }
    
    def export_dashboard_report(
        self,
        model_name: str,
        time_range_days: int = 7,
        format: str = 'json'
    ) -> Dict[str, Any]:
        """
        Export dashboard report for compliance audits
        
        Args:
            model_name: Name of the model
            time_range_days: Number of days to analyze
            format: Export format ('json' or 'summary')
        
        Returns:
            Exportable report data
        """
        dashboard_data = self.generate_dashboard_summary(model_name, time_range_days)
        
        if format == 'summary':
            # Generate human-readable summary
            accuracy = dashboard_data['accuracy_metrics'].get('accuracy_percentage', 'N/A')
            bias_detected = dashboard_data['bias_metrics'].get('bias_detected', False)
            
            return {
                'report_id': f"report_{uuid.uuid4().hex[:12]}",
                'model_name': model_name,
                'report_date': datetime.now(timezone.utc).isoformat(),
                'time_range_days': time_range_days,
                'summary': {
                    'model_accuracy': f"{accuracy}%" if accuracy != 'N/A' else 'N/A',
                    'bias_detected': 'Yes' if bias_detected else 'No',
                    'total_predictions': dashboard_data['accuracy_metrics'].get('total_predictions', 0),
                    'avg_confidence': dashboard_data['confidence_distribution'].get('avg_confidence', 'N/A')
                },
                'full_data': dashboard_data
            }
        
        return dashboard_data


# Global dashboard instance
_dashboard_instance: Optional[ExplainabilityDashboard] = None


def get_explainability_dashboard() -> ExplainabilityDashboard:
    """
    Get or create the global ExplainabilityDashboard instance
    """
    global _dashboard_instance
    
    if _dashboard_instance is None:
        _dashboard_instance = ExplainabilityDashboard()
    
    return _dashboard_instance
