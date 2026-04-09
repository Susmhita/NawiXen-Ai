"""
Nawixen AI Engine - FastAPI Application
Provides AI-powered route optimization, demand forecasting, anomaly detection, and ETA predictions.
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from pydantic import BaseModel

from services.route_optimizer import RouteOptimizer
from services.demand_forecaster import DemandForecaster
from services.anomaly_detector import AnomalyDetector
from services.eta_predictor import ETAPredictor

load_dotenv()

# Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# Initialize AI services
route_optimizer = RouteOptimizer()
demand_forecaster = DemandForecaster()
anomaly_detector = AnomalyDetector()
eta_predictor = ETAPredictor()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - initialize and cleanup resources."""
    print("🚀 Nawixen AI Engine starting up...")
    # Load ML models
    demand_forecaster.load_model()
    anomaly_detector.load_model()
    eta_predictor.load_model()
    yield
    print("👋 Nawixen AI Engine shutting down...")


app = FastAPI(
    title="Nawixen AI Engine",
    description="AI-powered logistics optimization engine",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Auth dependency
async def verify_token(authorization: Optional[str] = Header(None)):
    """Verify JWT token from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")


# Request/Response Models
class Location(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None


class Stop(BaseModel):
    id: str
    location: Location
    type: str  # "pickup" or "delivery"
    priority: str = "normal"  # "low", "normal", "high", "urgent"
    time_window: Optional[tuple[str, str]] = None  # (start, end) ISO strings


class RouteOptimizationRequest(BaseModel):
    stops: list[Stop]
    vehicle_capacity: Optional[float] = None
    start_location: Optional[Location] = None
    end_location: Optional[Location] = None
    optimize_for: str = "time"  # "time", "distance", or "balanced"


class RouteOptimizationResponse(BaseModel):
    optimized_stops: list[Stop]
    total_distance_km: float
    total_duration_minutes: float
    savings_percent: float
    route_polyline: Optional[str] = None


class DemandForecastRequest(BaseModel):
    zone_id: str
    forecast_days: int = 7
    historical_days: int = 30


class DemandForecastResponse(BaseModel):
    zone_id: str
    forecasts: list[dict]  # {date, predicted_orders, confidence}
    peak_day: str
    peak_hour: int
    trend: str  # "increasing", "decreasing", "stable"


class AnomalyDetectionRequest(BaseModel):
    data_type: str  # "delivery_time", "route_deviation", "demand_spike", "driver_behavior"
    data_points: list[dict]
    sensitivity: float = 0.5  # 0.0 to 1.0


class AnomalyDetectionResponse(BaseModel):
    anomalies: list[dict]  # {index, value, severity, description}
    anomaly_count: int
    recommendation: str


class ETAPredictionRequest(BaseModel):
    origin: Location
    destination: Location
    departure_time: Optional[str] = None  # ISO string
    vehicle_type: str = "van"  # "bike", "van", "truck"
    traffic_conditions: str = "normal"  # "light", "normal", "heavy"


class ETAPredictionResponse(BaseModel):
    eta_minutes: float
    confidence: float
    distance_km: float
    traffic_factor: float
    arrival_time: str  # ISO string


# Health Check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "nawixen-ai-engine",
        "version": "1.0.0",
    }


# Route Optimization
@app.post("/api/optimize-route", response_model=RouteOptimizationResponse)
async def optimize_route(
    request: RouteOptimizationRequest,
    user: dict = Depends(verify_token)
):
    """
    Optimize delivery route using AI algorithms.
    Uses Google OR-Tools for TSP/VRP solving.
    """
    try:
        result = await route_optimizer.optimize(
            stops=request.stops,
            vehicle_capacity=request.vehicle_capacity,
            start_location=request.start_location,
            end_location=request.end_location,
            optimize_for=request.optimize_for,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


# Demand Forecasting
@app.post("/api/forecast-demand", response_model=DemandForecastResponse)
async def forecast_demand(
    request: DemandForecastRequest,
    user: dict = Depends(verify_token)
):
    """
    Forecast demand for a specific zone.
    Uses time-series analysis and ML models.
    """
    try:
        result = await demand_forecaster.forecast(
            zone_id=request.zone_id,
            forecast_days=request.forecast_days,
            historical_days=request.historical_days,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting failed: {str(e)}")


# Anomaly Detection
@app.post("/api/detect-anomalies", response_model=AnomalyDetectionResponse)
async def detect_anomalies(
    request: AnomalyDetectionRequest,
    user: dict = Depends(verify_token)
):
    """
    Detect anomalies in operational data.
    Uses Isolation Forest and statistical methods.
    """
    try:
        result = await anomaly_detector.detect(
            data_type=request.data_type,
            data_points=request.data_points,
            sensitivity=request.sensitivity,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")


# ETA Prediction
@app.post("/api/predict-eta", response_model=ETAPredictionResponse)
async def predict_eta(
    request: ETAPredictionRequest,
    user: dict = Depends(verify_token)
):
    """
    Predict estimated time of arrival.
    Uses ML model with traffic and historical data.
    """
    try:
        result = await eta_predictor.predict(
            origin=request.origin,
            destination=request.destination,
            departure_time=request.departure_time,
            vehicle_type=request.vehicle_type,
            traffic_conditions=request.traffic_conditions,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ETA prediction failed: {str(e)}")


# Batch Optimization
@app.post("/api/batch-optimize")
async def batch_optimize(
    routes: list[RouteOptimizationRequest],
    user: dict = Depends(verify_token)
):
    """Optimize multiple routes in batch."""
    results = []
    for route_request in routes:
        try:
            result = await route_optimizer.optimize(
                stops=route_request.stops,
                vehicle_capacity=route_request.vehicle_capacity,
                start_location=route_request.start_location,
                end_location=route_request.end_location,
                optimize_for=route_request.optimize_for,
            )
            results.append({"status": "success", "result": result})
        except Exception as e:
            results.append({"status": "error", "error": str(e)})
    
    return {"results": results, "total": len(results)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
