"""
Route Optimizer Service
Uses Google OR-Tools for Vehicle Routing Problem (VRP) and TSP solving.
"""

import math
from typing import Optional
import httpx
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp


class RouteOptimizer:
    """AI-powered route optimization using OR-Tools."""

    def __init__(self):
        self.osrm_base_url = "http://router.project-osrm.org"
    
    async def optimize(
        self,
        stops: list,
        vehicle_capacity: Optional[float] = None,
        start_location = None,
        end_location = None,
        optimize_for: str = "time",
    ) -> dict:
        """
        Optimize route using TSP/VRP algorithms.
        
        Args:
            stops: List of Stop objects with location data
            vehicle_capacity: Optional vehicle capacity constraint
            start_location: Optional depot/start location
            end_location: Optional end location (if different from start)
            optimize_for: Optimization objective ("time", "distance", "balanced")
        
        Returns:
            Optimized route with metrics
        """
        if len(stops) < 2:
            return {
                "optimized_stops": stops,
                "total_distance_km": 0,
                "total_duration_minutes": 0,
                "savings_percent": 0,
                "route_polyline": None,
            }
        
        # Build distance matrix
        locations = [{"lat": s.location.lat, "lng": s.location.lng} for s in stops]
        
        # Add depot if specified
        if start_location:
            locations.insert(0, {"lat": start_location.lat, "lng": start_location.lng})
        
        distance_matrix, duration_matrix = await self._build_matrices(locations)
        
        # Calculate original (unoptimized) metrics
        original_distance = sum(
            distance_matrix[i][i + 1] for i in range(len(locations) - 1)
        )
        original_duration = sum(
            duration_matrix[i][i + 1] for i in range(len(locations) - 1)
        )
        
        # Solve TSP/VRP
        optimized_order = self._solve_tsp(
            distance_matrix if optimize_for == "distance" else duration_matrix,
            depot=0 if start_location else None,
        )
        
        # Reorder stops based on solution
        if start_location:
            # Remove depot index and adjust indices
            stop_order = [i - 1 for i in optimized_order if i > 0]
        else:
            stop_order = optimized_order
        
        optimized_stops = [stops[i] for i in stop_order if i < len(stops)]
        
        # Calculate optimized metrics
        optimized_distance = sum(
            distance_matrix[optimized_order[i]][optimized_order[i + 1]]
            for i in range(len(optimized_order) - 1)
        )
        optimized_duration = sum(
            duration_matrix[optimized_order[i]][optimized_order[i + 1]]
            for i in range(len(optimized_order) - 1)
        )
        
        # Calculate savings
        distance_savings = (
            (original_distance - optimized_distance) / original_distance * 100
            if original_distance > 0 else 0
        )
        
        # Get route polyline from OSRM
        route_polyline = await self._get_route_polyline(
            [{"lat": s.location.lat, "lng": s.location.lng} for s in optimized_stops]
        )
        
        return {
            "optimized_stops": optimized_stops,
            "total_distance_km": round(optimized_distance / 1000, 2),
            "total_duration_minutes": round(optimized_duration / 60, 2),
            "savings_percent": round(max(0, distance_savings), 1),
            "route_polyline": route_polyline,
        }
    
    async def _build_matrices(self, locations: list[dict]) -> tuple[list, list]:
        """Build distance and duration matrices using OSRM."""
        n = len(locations)
        distance_matrix = [[0] * n for _ in range(n)]
        duration_matrix = [[0] * n for _ in range(n)]
        
        # Build OSRM table request
        coords = ";".join([f"{loc['lng']},{loc['lat']}" for loc in locations])
        url = f"{self.osrm_base_url}/table/v1/driving/{coords}?annotations=distance,duration"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=30.0)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("code") == "Ok":
                        distance_matrix = data.get("distances", distance_matrix)
                        duration_matrix = data.get("durations", duration_matrix)
                        return distance_matrix, duration_matrix
        except Exception as e:
            print(f"OSRM request failed: {e}, using Haversine fallback")
        
        # Fallback to Haversine distance
        for i in range(n):
            for j in range(n):
                if i != j:
                    dist = self._haversine_distance(
                        locations[i]["lat"], locations[i]["lng"],
                        locations[j]["lat"], locations[j]["lng"]
                    )
                    distance_matrix[i][j] = dist * 1000  # meters
                    # Estimate duration: assume 30 km/h average speed
                    duration_matrix[i][j] = (dist / 30) * 3600  # seconds
        
        return distance_matrix, duration_matrix
    
    def _solve_tsp(self, matrix: list, depot: Optional[int] = None) -> list[int]:
        """Solve TSP using OR-Tools."""
        n = len(matrix)
        
        if n <= 2:
            return list(range(n))
        
        # Create routing index manager
        depot_index = depot if depot is not None else 0
        manager = pywrapcp.RoutingIndexManager(n, 1, depot_index)
        
        # Create routing model
        routing = pywrapcp.RoutingModel(manager)
        
        # Create distance callback
        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return int(matrix[from_node][to_node])
        
        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        
        # Set search parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.seconds = 5
        
        # Solve
        solution = routing.SolveWithParameters(search_parameters)
        
        if solution:
            route = []
            index = routing.Start(0)
            while not routing.IsEnd(index):
                route.append(manager.IndexToNode(index))
                index = solution.Value(routing.NextVar(index))
            route.append(manager.IndexToNode(index))
            return route[:-1]  # Remove duplicate end node
        
        # Fallback to original order
        return list(range(n))
    
    async def _get_route_polyline(self, locations: list[dict]) -> Optional[str]:
        """Get route polyline from OSRM."""
        if len(locations) < 2:
            return None
        
        coords = ";".join([f"{loc['lng']},{loc['lat']}" for loc in locations])
        url = f"{self.osrm_base_url}/route/v1/driving/{coords}?overview=full&geometries=polyline"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=30.0)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("code") == "Ok" and data.get("routes"):
                        return data["routes"][0].get("geometry")
        except Exception as e:
            print(f"Failed to get route polyline: {e}")
        
        return None
    
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
