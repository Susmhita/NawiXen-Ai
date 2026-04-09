// Nawixen AI - OSRM Routing Service (OpenStreetMap Routing)
import { IStop } from '../models/index.js'

const OSRM_BASE_URL = process.env.OSRM_URL || 'https://router.project-osrm.org'

interface OSRMRouteResponse {
  code: string
  routes: Array<{
    distance: number
    duration: number
    geometry: {
      coordinates: [number, number][]
    }
    legs: Array<{
      distance: number
      duration: number
      steps: Array<{
        distance: number
        duration: number
        geometry: {
          coordinates: [number, number][]
        }
      }>
    }>
  }>
}

interface OSRMTableResponse {
  code: string
  durations: number[][]
  distances: number[][]
}

interface RouteLeg {
  from: number
  to: number
  distance: number
  duration: number
  geometry: [number, number][]
}

interface OptimizationResult {
  optimizedOrder: number[]
  totalDistance: number
  totalDuration: number
  routeGeometry: [number, number][]
  legs: RouteLeg[]
  savings: {
    distanceSaved: number
    timeSaved: number
    percentageImproved: number
  }
}

// Get route between points using OSRM
export async function getRoute(
  coordinates: [number, number][]
): Promise<{ distance: number; duration: number; geometry: [number, number][] }> {
  const coordString = coordinates.map(c => `${c[0]},${c[1]}`).join(';')
  
  const response = await fetch(
    `${OSRM_BASE_URL}/route/v1/driving/${coordString}?overview=full&geometries=geojson`
  )

  if (!response.ok) {
    throw new Error(`OSRM route request failed: ${response.statusText}`)
  }

  const data: OSRMRouteResponse = await response.json()

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error('No route found')
  }

  const route = data.routes[0]
  return {
    distance: route.distance,
    duration: route.duration,
    geometry: route.geometry.coordinates,
  }
}

// Get distance/duration matrix using OSRM Table service
export async function getDistanceMatrix(
  coordinates: [number, number][]
): Promise<{ distances: number[][]; durations: number[][] }> {
  const coordString = coordinates.map(c => `${c[0]},${c[1]}`).join(';')
  
  const response = await fetch(
    `${OSRM_BASE_URL}/table/v1/driving/${coordString}?annotations=distance,duration`
  )

  if (!response.ok) {
    throw new Error(`OSRM table request failed: ${response.statusText}`)
  }

  const data: OSRMTableResponse = await response.json()

  if (data.code !== 'Ok') {
    throw new Error('Failed to get distance matrix')
  }

  return {
    distances: data.distances,
    durations: data.durations,
  }
}

// Simple nearest neighbor TSP solver
function solveTSPNearestNeighbor(
  distanceMatrix: number[][],
  startIndex: number = 0
): number[] {
  const n = distanceMatrix.length
  const visited = new Set<number>()
  const tour: number[] = [startIndex]
  visited.add(startIndex)

  while (tour.length < n) {
    const current = tour[tour.length - 1]
    let nearest = -1
    let nearestDistance = Infinity

    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distanceMatrix[current][i] < nearestDistance) {
        nearest = i
        nearestDistance = distanceMatrix[current][i]
      }
    }

    if (nearest !== -1) {
      tour.push(nearest)
      visited.add(nearest)
    }
  }

  return tour
}

// 2-opt improvement for TSP
function improve2Opt(
  tour: number[],
  distanceMatrix: number[][]
): number[] {
  let improved = true
  let bestTour = [...tour]

  while (improved) {
    improved = false
    for (let i = 0; i < bestTour.length - 2; i++) {
      for (let j = i + 2; j < bestTour.length; j++) {
        const newTour = twoOptSwap(bestTour, i, j)
        if (calculateTourDistance(newTour, distanceMatrix) < calculateTourDistance(bestTour, distanceMatrix)) {
          bestTour = newTour
          improved = true
        }
      }
    }
  }

  return bestTour
}

function twoOptSwap(tour: number[], i: number, j: number): number[] {
  const newTour = tour.slice(0, i + 1)
  for (let k = j; k > i; k--) {
    newTour.push(tour[k])
  }
  for (let k = j + 1; k < tour.length; k++) {
    newTour.push(tour[k])
  }
  return newTour
}

function calculateTourDistance(tour: number[], distanceMatrix: number[][]): number {
  let distance = 0
  for (let i = 0; i < tour.length - 1; i++) {
    distance += distanceMatrix[tour[i]][tour[i + 1]]
  }
  return distance
}

// Main route optimization function
export async function optimizeRoute(stops: IStop[]): Promise<OptimizationResult> {
  if (stops.length < 2) {
    throw new Error('At least 2 stops required for optimization')
  }

  // Extract coordinates [lng, lat] for OSRM
  const coordinates: [number, number][] = stops.map(stop => [
    stop.location.lng,
    stop.location.lat,
  ])

  // Get distance matrix
  const { distances, durations } = await getDistanceMatrix(coordinates)

  // Calculate original order distances
  let originalDistance = 0
  let originalDuration = 0
  for (let i = 0; i < stops.length - 1; i++) {
    originalDistance += distances[i][i + 1]
    originalDuration += durations[i][i + 1]
  }

  // Solve TSP using nearest neighbor + 2-opt improvement
  let optimizedOrder = solveTSPNearestNeighbor(distances)
  optimizedOrder = improve2Opt(optimizedOrder, distances)

  // Calculate optimized distances
  let optimizedDistance = 0
  let optimizedDuration = 0
  const legs: RouteLeg[] = []

  for (let i = 0; i < optimizedOrder.length - 1; i++) {
    const from = optimizedOrder[i]
    const to = optimizedOrder[i + 1]
    
    optimizedDistance += distances[from][to]
    optimizedDuration += durations[from][to]
    
    legs.push({
      from,
      to,
      distance: distances[from][to],
      duration: durations[from][to],
      geometry: [], // Will be filled by detailed route
    })
  }

  // Get detailed route geometry for optimized order
  const optimizedCoordinates = optimizedOrder.map(i => coordinates[i])
  const detailedRoute = await getRoute(optimizedCoordinates)

  return {
    optimizedOrder,
    totalDistance: Math.round(optimizedDistance),
    totalDuration: Math.round(optimizedDuration),
    routeGeometry: detailedRoute.geometry,
    legs,
    savings: {
      distanceSaved: Math.round(originalDistance - optimizedDistance),
      timeSaved: Math.round(originalDuration - optimizedDuration),
      percentageImproved: Math.round(
        ((originalDistance - optimizedDistance) / originalDistance) * 100
      ),
    },
  }
}

// Geocode address using Nominatim
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const encodedAddress = encodeURIComponent(address)
  
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`,
    {
      headers: {
        'User-Agent': 'Nawixen-AI/1.0',
      },
    }
  )

  if (!response.ok) {
    return null
  }

  const data = await response.json()

  if (!data || data.length === 0) {
    return null
  }

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  }
}

// Reverse geocode coordinates
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    {
      headers: {
        'User-Agent': 'Nawixen-AI/1.0',
      },
    }
  )

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  return data.display_name || null
}
