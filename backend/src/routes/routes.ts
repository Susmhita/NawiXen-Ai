// Nawixen AI - Route Management Routes
import { Router, Response } from 'express'
import { Route, Driver } from '../models/index.js'
import { authenticate, companyAccess, AuthRequest } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/error.js'
import { optimizeRoute } from '../services/osrm.js'

const router = Router()

// Apply authentication to all routes
router.use(authenticate, companyAccess)

// GET /api/routes - List all routes
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, page = '1', limit = '20' } = req.query
    const companyId = req.jwtPayload?.companyId

    const query: Record<string, unknown> = { companyId }
    if (status) query.status = status

    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum

    const [routes, total] = await Promise.all([
      Route.find(query)
        .populate('driverId', 'name phone vehicleType status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Route.countDocuments(query),
    ])

    res.json({
      success: true,
      data: routes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  })
)

// GET /api/routes/:id - Get single route
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const route = await Route.findOne({
      _id: req.params.id,
      companyId: req.jwtPayload?.companyId,
    }).populate('driverId', 'name phone vehicleType status currentLocation')

    if (!route) {
      throw new AppError('Route not found', 404)
    }

    res.json(route)
  })
)

// POST /api/routes - Create new route
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, stops } = req.body

    if (!name || !stops || !Array.isArray(stops) || stops.length === 0) {
      throw new AppError('Name and stops are required', 400)
    }

    const route = await Route.create({
      name,
      stops: stops.map((stop: Record<string, unknown>, index: number) => ({
        ...stop,
        id: stop.id || `stop-${index + 1}`,
        status: 'pending',
        order: index,
      })),
      companyId: req.jwtPayload?.companyId,
      status: 'draft',
    })

    res.status(201).json(route)
  })
)

// PUT /api/routes/:id - Update route
router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, stops, status } = req.body

    const route = await Route.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.jwtPayload?.companyId,
      },
      { name, stops, status },
      { new: true, runValidators: true }
    )

    if (!route) {
      throw new AppError('Route not found', 404)
    }

    res.json(route)
  })
)

// DELETE /api/routes/:id - Delete route
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const route = await Route.findOneAndDelete({
      _id: req.params.id,
      companyId: req.jwtPayload?.companyId,
    })

    if (!route) {
      throw new AppError('Route not found', 404)
    }

    res.json({ message: 'Route deleted successfully' })
  })
)

// POST /api/routes/:id/optimize - Optimize route using AI
router.post(
  '/:id/optimize',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const route = await Route.findOne({
      _id: req.params.id,
      companyId: req.jwtPayload?.companyId,
    })

    if (!route) {
      throw new AppError('Route not found', 404)
    }

    if (route.stops.length < 2) {
      throw new AppError('At least 2 stops are required for optimization', 400)
    }

    // Call optimization service
    const result = await optimizeRoute(route.stops)

    // Update route with optimized data
    route.optimizedOrder = result.optimizedOrder
    route.totalDistance = result.totalDistance
    route.totalDuration = result.totalDuration
    route.routeGeometry = result.routeGeometry
    route.status = 'optimized'

    // Reorder stops based on optimization
    const reorderedStops = result.optimizedOrder.map((index, newOrder) => ({
      ...route.stops[index].toObject(),
      order: newOrder,
    }))
    route.stops = reorderedStops

    await route.save()

    res.json({
      route,
      optimization: {
        savings: result.savings,
        legs: result.legs,
      },
    })
  })
)

// POST /api/routes/:id/assign - Assign driver to route
router.post(
  '/:id/assign',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { driverId } = req.body

    if (!driverId) {
      throw new AppError('Driver ID is required', 400)
    }

    // Verify driver exists and belongs to same company
    const driver = await Driver.findOne({
      _id: driverId,
      companyId: req.jwtPayload?.companyId,
    })

    if (!driver) {
      throw new AppError('Driver not found', 404)
    }

    if (driver.status === 'on_route') {
      throw new AppError('Driver is already on another route', 400)
    }

    const route = await Route.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.jwtPayload?.companyId,
      },
      { driverId, status: 'assigned' },
      { new: true }
    ).populate('driverId', 'name phone vehicleType')

    if (!route) {
      throw new AppError('Route not found', 404)
    }

    res.json(route)
  })
)

// POST /api/routes/:id/start - Start route
router.post(
  '/:id/start',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const route = await Route.findOne({
      _id: req.params.id,
      companyId: req.jwtPayload?.companyId,
    })

    if (!route) {
      throw new AppError('Route not found', 404)
    }

    if (!route.driverId) {
      throw new AppError('Route must be assigned to a driver first', 400)
    }

    route.status = 'in_progress'
    route.startTime = new Date()
    await route.save()

    // Update driver status
    await Driver.findByIdAndUpdate(route.driverId, { status: 'on_route' })

    res.json(route)
  })
)

// POST /api/routes/:id/complete - Complete route
router.post(
  '/:id/complete',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const route = await Route.findOne({
      _id: req.params.id,
      companyId: req.jwtPayload?.companyId,
    })

    if (!route) {
      throw new AppError('Route not found', 404)
    }

    route.status = 'completed'
    route.endTime = new Date()
    
    // Mark all pending stops as completed
    route.stops = route.stops.map(stop => ({
      ...stop.toObject ? stop.toObject() : stop,
      status: stop.status === 'pending' ? 'completed' : stop.status,
      completedAt: stop.status === 'pending' ? new Date() : stop.completedAt,
    }))
    
    await route.save()

    // Update driver status and increment delivery count
    if (route.driverId) {
      const completedStops = route.stops.filter(s => s.status === 'completed').length
      await Driver.findByIdAndUpdate(route.driverId, {
        status: 'available',
        $inc: { totalDeliveries: completedStops },
      })
    }

    res.json(route)
  })
)

// PATCH /api/routes/:id/stops/:stopId - Update stop status
router.patch(
  '/:id/stops/:stopId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status } = req.body

    const route = await Route.findOne({
      _id: req.params.id,
      companyId: req.jwtPayload?.companyId,
    })

    if (!route) {
      throw new AppError('Route not found', 404)
    }

    const stopIndex = route.stops.findIndex(s => s.id === req.params.stopId)
    if (stopIndex === -1) {
      throw new AppError('Stop not found', 404)
    }

    route.stops[stopIndex].status = status
    
    if (status === 'arrived') {
      route.stops[stopIndex].arrivedAt = new Date()
    } else if (status === 'completed') {
      route.stops[stopIndex].completedAt = new Date()
    }

    await route.save()

    res.json(route)
  })
)

export default router
