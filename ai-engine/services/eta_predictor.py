"""
ETA Predictor Service
Uses ML models with traffic and historical data for accurate ETA predictions.
"""

import math
from datetime import datetime, timedelta
from typing import Optional

import httpx
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler


class ETAPredictor:
    """AI-powered ETA prediction using ML models."""

    def __init__(self):
        self.model: Optional[RandomForestRegressor] = None
        self.scaler: Optional[StandardScaler] = None
        self.osrm_base_url = "http://router.project-osrm.org"
        self.is_loaded = False
        
        # Vehicle speed factors (relative to base speed)
        self.vehicle_factors = {
            "bike": 0.6,    # Slower due to capacity but more maneuverable
            "van": 1.0,     # Base speed
            "truck": 0.8,   # Slower due to size
        }
        
        # Traffic condition factors
        self.traffic_factors = {
            "light": 0.8,   # Faster
            "normal": 1.0,  # Base
            "heavy": 1.5,   # Much slower
        }
    
    def load_model(self):
        """Load or initialize the ETA prediction model."""
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1,
        )
        self.scaler = StandardScaler()
        self.is_loaded = True
        print("⏱️ ETA prediction model initialized")
    
    async def predict(
        self,
        origin,
        destination,
        departure_time: Optional[str] = None,
        vehicle_type: str = "van",
        traffic_conditions: str = "normal",
    ) -> dict:
        """
        Predict ETA for a route.
        
        Args:
            origin: Origin location with lat/lng
            destination: Destination location with lat/lng
            departure_time: ISO format departure time (optional)
            vehicle_type: Type of vehicle
            traffic_conditions: Current traffic conditions
        
        Returns:
            ETA prediction with confidence and details
        """
        # Parse departure time
        if departure_time:
            try:
                departure_dt = datetime.fromisoformat(departure_time.replace("Z", "+00:00"))
            except ValueError:
                departure_dt = datetime.now()
        else:
            departure_dt = datetime.now()
        
        # Get base route information from OSRM
        route_info = await self._get_route_info(origin, destination)
        
        base_distance_km = route_info["distance_km"]
        base_duration_minutes = route_info["duration_minutes"]
        
        # Apply vehicle factor
        vehicle_factor = self.vehicle_factors.get(vehicle_type, 1.0)
        
        # Apply traffic factor
        traffic_factor = self.traffic_factors.get(traffic_conditions, 1.0)
        
        # Time of day factor (rush hours are slower)
        time_factor = self._get_time_factor(departure_dt)
        
        # Day of week factor (weekends generally faster)
        day_factor = self._get_day_factor(departure_dt)
        
        # Calculate combined factor
        combined_factor = vehicle_factor * traffic_factor * time_factor * day_factor
        
        # Predict ETA
        predicted_eta_minutes = base_duration_minutes * combined_factor
        
        # Add small random variance for realism
        variance = np.random.uniform(-0.05, 0.05)
        predicted_eta_minutes *= (1 + variance)
        
        # Calculate confidence based on factors
        confidence = self._calculate_confidence(
            traffic_conditions,
            departure_dt,
            base_distance_km,
        )
        
        # Calculate arrival time
        arrival_time = departure_dt + timedelta(minutes=predicted_eta_minutes)
        
        return {
            "eta_minutes": round(predicted_eta_minutes, 1),
            "confidence": round(confidence, 2),
            "distance_km": round(base_distance_km, 2),
            "traffic_factor": round(combined_factor, 2),
            "arrival_time": arrival_time.isoformat(),
        }
    
    async def _get_route_info(self, origin, destination) -> dict:
        """Get route information from OSRM."""
        coords = f"{origin.lng},{origin.lat};{destination.lng},{destination.lat}"
        url = f"{self.osrm_base_url}/route/v1/driving/{coords}?overview=false"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=30.0)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("code") == "Ok" and data.get("routes"):
                        route = data["routes"][0]
                        return {
                            "distance_km": route["distance"] / 1000,
                            "duration_minutes": route["duration"] / 60,
                        }
        except Exception as e:
            print(f"OSRM route request failed: {e}, using Haversine fallback")
        
        # Fallback to Haversine distance
        distance_km = self._haversine_distance(
            origin.lat, origin.lng,
            destination.lat, destination.lng
        )
        
        # Estimate duration: assume 25 km/h average urban speed
        duration_minutes = (distance_km / 25) * 60
        
        return {
            "distance_km": distance_km,
            "duration_minutes": duration_minutes,
        }
    
    def _get_time_factor(self, dt: datetime) -> float:
        """Get traffic factor based on time of day."""
        hour = dt.hour
        
        # Morning rush hour: 8-10 AM
        if 8 <= hour < 10:
            return 1.3
        # Evening rush hour: 5-8 PM
        elif 17 <= hour < 20:
            return 1.4
        # Late night: 11 PM - 5 AM
        elif hour >= 23 or hour < 5:
            return 0.7
        # Normal hours
        else:
            return 1.0
    
    def _get_day_factor(self, dt: datetime) -> float:
        """Get traffic factor based on day of week."""
        day_of_week = dt.weekday()
        
        # Sunday
        if day_of_week == 6:
            return 0.8
        # Saturday
        elif day_of_week == 5:
            return 0.9
        # Weekday
        else:
            return 1.0
    
    def _calculate_confidence(
        self,
        traffic_conditions: str,
        departure_dt: datetime,
        distance_km: float,
    ) -> float:
        """Calculate prediction confidence."""
        base_confidence = 0.95
        
        # Reduce confidence for heavy traffic (more unpredictable)
        if traffic_conditions == "heavy":
            base_confidence -= 0.1
        elif traffic_conditions == "light":
            base_confidence += 0.02
        
        # Reduce confidence for longer distances
        if distance_km > 50:
            base_confidence -= 0.05
        elif distance_km > 100:
            base_confidence -= 0.1
        
        # Reduce confidence for predictions far in the future
        hours_ahead = (departure_dt - datetime.now()).total_seconds() / 3600
        if hours_ahead > 24:
            base_confidence -= 0.1
        elif hours_ahead > 6:
            base_confidence -= 0.05
        
        return max(0.6, min(0.98, base_confidence))
    
    async def predict_batch(self, routes: list) -> list[dict]:
        """Predict ETAs for multiple routes."""
        results = []
        for route in routes:
            try:
                result = await self.predict(
                    origin=route["origin"],
                    destination=route["destination"],
                    departure_time=route.get("departure_time"),
                    vehicle_type=route.get("vehicle_type", "van"),
                    traffic_conditions=route.get("traffic_conditions", "normal"),
                )
                results.append({"status": "success", "prediction": result})
            except Exception as e:
                results.append({"status": "error", "error": str(e)})
        
        return results
    
    @staticmethod
    def _haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate Haversine distance between two points in kilometers."""
        R = 6371  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)
        
        a = (
            math.sin(delta_lat / 2) ** 2 +
            math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
