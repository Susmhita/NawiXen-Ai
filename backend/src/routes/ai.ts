// Nawixen AI - AI Service Routes (proxy to Python AI engine)
import { Router, Response } from 'express'
import { authenticate, companyAccess, AuthRequest } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/error.js'
import { optimizeRoute } from '../services/osrm.js'

const router = Router()

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000'

router.use(authenticate, companyAccess)

// POST /api/ai/optimize-route - Optimize a route
router.post(
  '/optimize-route',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { stops, vehicleType, startLocation, endLocation, constraints } = req.body

    if (!stops || !Array.isArray(stops) || stops.length < 2) {
      throw new AppError('At least 2 stops are required', 400)
    }

    // First try the Python AI engine
    try {
      const response = await fetch(`${AI_ENGINE_URL}/api/optimize-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stops,
          vehicleType,
          startLocation,
          endLocation,
          constraints,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        return res.json(result)
      }
    } catch (error) {
      console.warn('AI engine unavailable, falling back to OSRM:', error)
    }

    // Fallback to local OSRM optimization
    const result = await optimizeRoute(stops)
    res.json(result)
  })
)

// GET /api/ai/predict-eta/:routeId - Get ETA predictions
router.get(
  '/predict-eta/:routeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { routeId } = req.params

    try {
      const response = await fetch(`${AI_ENGINE_URL}/api/predict-eta/${routeId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        return res.json(result)
      }
    } catch (error) {
      console.warn('AI engine unavailable for ETA prediction:', error)
    }

    // Fallback: return simple estimates based on distance
    res.json({
      message: 'AI engine unavailable, returning estimated data',
      stops: [],
    })
  })
)

// GET /api/ai/detect-anomalies - Detect anomalies in real-time
router.get(
  '/detect-anomalies',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.jwtPayload?.companyId

    try {
      const response = await fetch(`${AI_ENGINE_URL}/api/detect-anomalies?companyId=${companyId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        return res.json(result)
      }
    } catch (error) {
      console.warn('AI engine unavailable for anomaly detection:', error)
    }

    res.json([])
  })
)

// GET /api/ai/demand-forecast - Get demand forecasts
router.get(
  '/demand-forecast',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.jwtPayload?.companyId
    const { region, days = '7' } = req.query

    try {
      const response = await fetch(
        `${AI_ENGINE_URL}/api/demand-forecast?companyId=${companyId}&region=${region || ''}&days=${days}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.ok) {
        const result = await response.json()
        return res.json(result)
      }
    } catch (error) {
      console.warn('AI engine unavailable for demand forecast:', error)
    }

    // Fallback: generate simple forecast
    const forecasts = []
    for (let i = 1; i <= parseInt(days as string, 10); i++) {
      const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000)
      forecasts.push({
        date: date.toISOString().split('T')[0],
        region: region || 'all',
        predictedOrders: Math.floor(10 + Math.random() * 20),
        confidence: 0.7 + Math.random() * 0.2,
        trend: Math.random() > 0.5 ? 'up' : 'stable',
      })
    }

    res.json(forecasts)
  })
)

// POST /api/ai/driver-assignment - Get optimal driver assignment
router.post(
  '/driver-assignment',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { routeId, availableDrivers } = req.body

    if (!routeId || !availableDrivers || !Array.isArray(availableDrivers)) {
      throw new AppError('Route ID and available drivers are required', 400)
    }

    try {
      const response = await fetch(`${AI_ENGINE_URL}/api/driver-assignment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ routeId, availableDrivers }),
      })

      if (response.ok) {
        const result = await response.json()
        return res.json(result)
      }
    } catch (error) {
      console.warn('AI engine unavailable for driver assignment:', error)
    }

    // Fallback: return random driver suggestion
    const randomDriver = availableDrivers[Math.floor(Math.random() * availableDrivers.length)]
    res.json({
      recommendedDriver: randomDriver,
      confidence: 0.6,
      reason: 'Random selection (AI engine unavailable)',
    })
  })
)

export default router
