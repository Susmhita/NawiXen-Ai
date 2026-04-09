"""
Demand Forecaster Service
Uses time-series analysis and ML models for demand prediction.
"""

import random
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler


class DemandForecaster:
    """AI-powered demand forecasting using ML models."""

    def __init__(self):
        self.model: Optional[GradientBoostingRegressor] = None
        self.scaler: Optional[StandardScaler] = None
        self.is_loaded = False
    
    def load_model(self):
        """Load or initialize the forecasting model."""
        # Initialize model with default parameters
        self.model = GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5,
            random_state=42,
        )
        self.scaler = StandardScaler()
        self.is_loaded = True
        print("📊 Demand forecasting model initialized")
    
    async def forecast(
        self,
        zone_id: str,
        forecast_days: int = 7,
        historical_days: int = 30,
    ) -> dict:
        """
        Forecast demand for a specific zone.
        
        Args:
            zone_id: Zone identifier
            forecast_days: Number of days to forecast
            historical_days: Days of historical data to consider
        
        Returns:
            Forecast with predictions and insights
        """
        # Generate synthetic historical data (in production, fetch from database)
        historical_data = self._generate_synthetic_history(historical_days)
        
        # Train model on historical data
        self._train_model(historical_data)
        
        # Generate forecasts
        forecasts = []
        today = datetime.now()
        
        peak_orders = 0
        peak_day = ""
        peak_hour = 12
        
        for day_offset in range(forecast_days):
            forecast_date = today + timedelta(days=day_offset)
            
            # Extract features for prediction
            features = self._extract_features(forecast_date)
            
            # Predict
            if self.model and self.scaler:
                scaled_features = self.scaler.transform([features])
                predicted = max(0, self.model.predict(scaled_features)[0])
            else:
                # Fallback prediction
                predicted = self._simple_forecast(forecast_date, historical_data)
            
            # Add some realistic variance
            predicted = int(predicted * (1 + random.uniform(-0.1, 0.1)))
            
            # Calculate confidence (decreases with forecast horizon)
            confidence = max(0.6, 0.95 - (day_offset * 0.05))
            
            forecast_entry = {
                "date": forecast_date.strftime("%Y-%m-%d"),
                "day_name": forecast_date.strftime("%A"),
                "predicted_orders": predicted,
                "confidence": round(confidence, 2),
                "lower_bound": int(predicted * 0.85),
                "upper_bound": int(predicted * 1.15),
            }
            forecasts.append(forecast_entry)
            
            # Track peak
            if predicted > peak_orders:
                peak_orders = predicted
                peak_day = forecast_date.strftime("%Y-%m-%d")
        
        # Determine trend
        if len(forecasts) >= 3:
            first_half_avg = np.mean([f["predicted_orders"] for f in forecasts[:len(forecasts)//2]])
            second_half_avg = np.mean([f["predicted_orders"] for f in forecasts[len(forecasts)//2:]])
            
            if second_half_avg > first_half_avg * 1.1:
                trend = "increasing"
            elif second_half_avg < first_half_avg * 0.9:
                trend = "decreasing"
            else:
                trend = "stable"
        else:
            trend = "stable"
        
        return {
            "zone_id": zone_id,
            "forecasts": forecasts,
            "peak_day": peak_day,
            "peak_hour": peak_hour,
            "trend": trend,
        }
    
    def _generate_synthetic_history(self, days: int) -> list[dict]:
        """Generate synthetic historical data for training."""
        data = []
        today = datetime.now()
        
        for day_offset in range(days, 0, -1):
            date = today - timedelta(days=day_offset)
            
            # Base demand varies by day of week
            day_of_week = date.weekday()
            base_demand = {
                0: 45,  # Monday
                1: 50,  # Tuesday
                2: 48,  # Wednesday
                3: 55,  # Thursday
                4: 60,  # Friday
                5: 70,  # Saturday
                6: 40,  # Sunday
            }.get(day_of_week, 50)
            
            # Add some variance
            actual_demand = int(base_demand * (1 + random.uniform(-0.2, 0.2)))
            
            data.append({
                "date": date,
                "day_of_week": day_of_week,
                "is_weekend": day_of_week >= 5,
                "orders": actual_demand,
            })
        
        return data
    
    def _train_model(self, historical_data: list[dict]):
        """Train the forecasting model on historical data."""
        if not historical_data or not self.model or not self.scaler:
            return
        
        X = []
        y = []
        
        for entry in historical_data:
            features = self._extract_features(entry["date"])
            X.append(features)
            y.append(entry["orders"])
        
        X = np.array(X)
        y = np.array(y)
        
        # Fit scaler and model
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
    
    def _extract_features(self, date: datetime) -> list[float]:
        """Extract features for a given date."""
        return [
            date.weekday(),  # Day of week (0-6)
            1 if date.weekday() >= 5 else 0,  # Is weekend
            date.day,  # Day of month
            date.month,  # Month
            np.sin(2 * np.pi * date.weekday() / 7),  # Cyclic day encoding
            np.cos(2 * np.pi * date.weekday() / 7),
            np.sin(2 * np.pi * date.month / 12),  # Cyclic month encoding
            np.cos(2 * np.pi * date.month / 12),
        ]
    
    def _simple_forecast(self, date: datetime, historical_data: list[dict]) -> float:
        """Simple forecasting fallback based on day of week averages."""
        day_of_week = date.weekday()
        
        same_day_orders = [
            d["orders"] for d in historical_data 
            if d["day_of_week"] == day_of_week
        ]
        
        if same_day_orders:
            return np.mean(same_day_orders)
        
        return 50  # Default fallback
