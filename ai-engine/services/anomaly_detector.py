"""
Anomaly Detector Service
Uses Isolation Forest and statistical methods for anomaly detection.
"""

from typing import Optional

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


class AnomalyDetector:
    """AI-powered anomaly detection for logistics operations."""

    def __init__(self):
        self.model: Optional[IsolationForest] = None
        self.scaler: Optional[StandardScaler] = None
        self.is_loaded = False
    
    def load_model(self):
        """Load or initialize the anomaly detection model."""
        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.1,  # Expected proportion of anomalies
            random_state=42,
            n_jobs=-1,
        )
        self.scaler = StandardScaler()
        self.is_loaded = True
        print("🔍 Anomaly detection model initialized")
    
    async def detect(
        self,
        data_type: str,
        data_points: list[dict],
        sensitivity: float = 0.5,
    ) -> dict:
        """
        Detect anomalies in operational data.
        
        Args:
            data_type: Type of data being analyzed
            data_points: List of data points to analyze
            sensitivity: Detection sensitivity (0.0 to 1.0)
        
        Returns:
            Detected anomalies with recommendations
        """
        if not data_points:
            return {
                "anomalies": [],
                "anomaly_count": 0,
                "recommendation": "No data provided for analysis.",
            }
        
        # Extract numerical values from data points
        values = self._extract_values(data_points, data_type)
        
        if len(values) < 5:
            return {
                "anomalies": [],
                "anomaly_count": 0,
                "recommendation": "Insufficient data points for anomaly detection. Need at least 5 samples.",
            }
        
        # Detect anomalies using Isolation Forest
        anomalies = self._detect_with_isolation_forest(values, data_points, sensitivity)
        
        # Also apply statistical detection for comparison
        statistical_anomalies = self._detect_with_statistics(values, data_points, sensitivity)
        
        # Merge results (union of both methods)
        all_anomaly_indices = set(a["index"] for a in anomalies)
        for sa in statistical_anomalies:
            if sa["index"] not in all_anomaly_indices:
                anomalies.append(sa)
        
        # Sort by severity
        severity_order = {"high": 0, "medium": 1, "low": 2}
        anomalies.sort(key=lambda x: severity_order.get(x["severity"], 3))
        
        # Generate recommendation based on data type and anomalies
        recommendation = self._generate_recommendation(data_type, anomalies)
        
        return {
            "anomalies": anomalies,
            "anomaly_count": len(anomalies),
            "recommendation": recommendation,
        }
    
    def _extract_values(self, data_points: list[dict], data_type: str) -> np.ndarray:
        """Extract numerical values from data points based on data type."""
        values = []
        
        for dp in data_points:
            if data_type == "delivery_time":
                value = dp.get("duration_minutes", dp.get("value", 0))
            elif data_type == "route_deviation":
                value = dp.get("deviation_km", dp.get("value", 0))
            elif data_type == "demand_spike":
                value = dp.get("order_count", dp.get("value", 0))
            elif data_type == "driver_behavior":
                value = dp.get("score", dp.get("value", 0))
            else:
                value = dp.get("value", 0)
            
            values.append(float(value))
        
        return np.array(values).reshape(-1, 1)
    
    def _detect_with_isolation_forest(
        self,
        values: np.ndarray,
        data_points: list[dict],
        sensitivity: float,
    ) -> list[dict]:
        """Detect anomalies using Isolation Forest."""
        if self.model is None or self.scaler is None:
            return []
        
        # Adjust contamination based on sensitivity
        contamination = 0.05 + (sensitivity * 0.15)  # Range: 0.05 to 0.20
        
        model = IsolationForest(
            n_estimators=100,
            contamination=contamination,
            random_state=42,
        )
        
        # Scale and fit
        scaled_values = self.scaler.fit_transform(values)
        predictions = model.fit_predict(scaled_values)
        scores = model.score_samples(scaled_values)
        
        anomalies = []
        for i, (pred, score) in enumerate(zip(predictions, scores)):
            if pred == -1:  # Anomaly
                # Determine severity based on anomaly score
                if score < -0.6:
                    severity = "high"
                elif score < -0.4:
                    severity = "medium"
                else:
                    severity = "low"
                
                anomalies.append({
                    "index": i,
                    "value": float(values[i][0]),
                    "severity": severity,
                    "score": float(score),
                    "description": self._generate_anomaly_description(
                        data_points[i], severity, float(values[i][0])
                    ),
                    "timestamp": data_points[i].get("timestamp"),
                })
        
        return anomalies
    
    def _detect_with_statistics(
        self,
        values: np.ndarray,
        data_points: list[dict],
        sensitivity: float,
    ) -> list[dict]:
        """Detect anomalies using statistical methods (Z-score and IQR)."""
        anomalies = []
        flat_values = values.flatten()
        
        # Calculate statistics
        mean = np.mean(flat_values)
        std = np.std(flat_values)
        q1 = np.percentile(flat_values, 25)
        q3 = np.percentile(flat_values, 75)
        iqr = q3 - q1
        
        # Threshold based on sensitivity
        z_threshold = 3.0 - (sensitivity * 1.5)  # Range: 1.5 to 3.0
        iqr_multiplier = 1.5 + (1 - sensitivity)  # Range: 1.5 to 2.5
        
        for i, value in enumerate(flat_values):
            # Z-score test
            z_score = abs((value - mean) / std) if std > 0 else 0
            
            # IQR test
            lower_bound = q1 - iqr_multiplier * iqr
            upper_bound = q3 + iqr_multiplier * iqr
            is_iqr_outlier = value < lower_bound or value > upper_bound
            
            if z_score > z_threshold or is_iqr_outlier:
                # Determine severity
                if z_score > z_threshold + 1 or (value < q1 - 2 * iqr or value > q3 + 2 * iqr):
                    severity = "high"
                elif z_score > z_threshold or is_iqr_outlier:
                    severity = "medium"
                else:
                    severity = "low"
                
                anomalies.append({
                    "index": i,
                    "value": float(value),
                    "severity": severity,
                    "z_score": float(z_score),
                    "description": self._generate_anomaly_description(
                        data_points[i], severity, float(value)
                    ),
                    "timestamp": data_points[i].get("timestamp"),
                })
        
        return anomalies
    
    def _generate_anomaly_description(
        self,
        data_point: dict,
        severity: str,
        value: float,
    ) -> str:
        """Generate human-readable description for an anomaly."""
        severity_text = {
            "high": "Critical",
            "medium": "Notable",
            "low": "Minor",
        }.get(severity, "")
        
        location = data_point.get("location", data_point.get("zone", "Unknown location"))
        
        return f"{severity_text} anomaly detected: Value {value:.2f} at {location}"
    
    def _generate_recommendation(self, data_type: str, anomalies: list[dict]) -> str:
        """Generate actionable recommendation based on detected anomalies."""
        if not anomalies:
            return "No anomalies detected. Operations are within normal parameters."
        
        high_severity = sum(1 for a in anomalies if a["severity"] == "high")
        medium_severity = sum(1 for a in anomalies if a["severity"] == "medium")
        
        recommendations = {
            "delivery_time": {
                "high": "Immediate attention required: Significant delivery delays detected. Consider route re-optimization or additional driver allocation.",
                "medium": "Monitor situation: Some delivery delays observed. Review traffic conditions and driver availability.",
                "low": "Minor delays detected. Continue monitoring for patterns.",
            },
            "route_deviation": {
                "high": "Critical: Major route deviations detected. Investigate for potential issues (road closures, driver errors).",
                "medium": "Route deviations observed. Review with drivers and update route data if needed.",
                "low": "Minor route variations detected. May be due to local conditions.",
            },
            "demand_spike": {
                "high": "Urgent: Significant demand spike detected. Allocate additional resources immediately.",
                "medium": "Demand increase observed. Pre-position vehicles in high-demand areas.",
                "low": "Slight demand variation detected. Monitor for developing patterns.",
            },
            "driver_behavior": {
                "high": "Critical: Driver performance issues detected. Schedule immediate review and training.",
                "medium": "Driver behavior variations observed. Consider coaching sessions.",
                "low": "Minor variations in driver performance. Continue standard monitoring.",
            },
        }
        
        if high_severity > 0:
            severity_key = "high"
        elif medium_severity > 0:
            severity_key = "medium"
        else:
            severity_key = "low"
        
        return recommendations.get(data_type, {}).get(
            severity_key,
            f"Review the {len(anomalies)} detected anomalies and take appropriate action."
        )
