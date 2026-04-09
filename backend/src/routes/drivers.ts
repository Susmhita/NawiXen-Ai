// Nawixen AI - Driver Management Routes
import { Router, Response } from 'express'
import { Driver, User, Tracking } from '../models/index.js'
import { authenticate, companyAccess, authorize, AuthRequest } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/error.js'

const router = Router()

router.use(authenticate, companyAccess)

// GET /api/drivers - List all drivers
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

    const [drivers, total] = await Promise.all([
      Driver.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Driver.countDocuments(query),
    ])

    res.json({
      success: true,
      data: drivers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  })
)

// GET /api/drivers/:id - Get single driver
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const driver = await Driver.findOne({
      _id: req.params.id,
      companyId: req.jwtPayload?.companyId,
    }).populate('userId', 'email name')

    if (!driver) {
      throw new AppError('Driver not found', 404)
    }

    res.json(driver)
  })
)

// POST /api/drivers - Create new driver (admin only)
router.post(
  '/',
  authorize('admin', 'dispatcher'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, email, phone, vehicleType, vehiclePlate, password } = req.body

    if (!name || !email || !phone || !vehicleType || !vehiclePlate || !password) {
      throw new AppError('All fields are required', 400)
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      throw new AppError('Email already registered', 409)
    }

    // Create user account for driver
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name,
      role: 'driver',
      companyId: req.jwtPayload?.companyId,
      phone,
    })

    // Create driver profile
    const driver = await Driver.create({
      name,
      email: email.toLowerCase(),
      phone,
      vehicleType,
      vehiclePlate,
      companyId: req.jwtPayload?.companyId,
      userId: user._id,
      status: 'offline',
    })

    res.status(201).json(driver)
  })
)

// PUT /api/drivers/:id - Update driver
router.put(
  '/:id',
  authorize('admin', 'dispatcher'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, phone, vehicleType, vehiclePlate } = req.body

    const driver = await Driver.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.jwtPayload?.companyId,
      },
      { name, phone, vehicleType, vehiclePlate },
      { new: true, runValidators: true }
    )

    if (!driver) {
      throw new AppError('Driver not found', 404)
    }

    res.json(driver)
  })
)

// DELETE /api/drivers/:id - Delete driver
router.delete(
  '/:id',
  authorize('admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const driver = await Driver.findOneAndDelete({
      _id: req.params.id,
      companyId: req.jwtPayload?.companyId,
    })

    if (!driver) {
      throw new AppError('Driver not found', 404)
    }

    // Also delete the associated user account
    await User.findByIdAndDelete(driver.userId)

    res.json({ message: 'Driver deleted successfully' })
  })
)

// PATCH /api/drivers/:id/status - Update driver status
router.patch(
  '/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status } = req.body

    if (!['available', 'on_route', 'offline', 'break'].includes(status)) {
      throw new AppError('Invalid status', 400)
    }

    const driver = await Driver.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.jwtPayload?.companyId,
      },
      { status },
      { new: true }
    )

    if (!driver) {
      throw new AppError('Driver not found', 404)
    }

    res.json(driver)
  })
)

// GET /api/drivers/:id/location - Get driver's current location
router.get(
  '/:id/location',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const driver = await Driver.findOne({
      _id: req.params.id,
      companyId: req.jwtPayload?.companyId,
    }).select('currentLocation')

    if (!driver) {
      throw new AppError('Driver not found', 404)
    }

    res.json(driver.currentLocation || null)
  })
)

// POST /api/drivers/:id/location - Update driver location (for driver app)
router.post(
  '/:id/location',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { lat, lng, speed, heading, batteryLevel, routeId } = req.body

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new AppError('Valid coordinates are required', 400)
    }

    // Update driver's current location
    const driver = await Driver.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.jwtPayload?.companyId,
      },
      {
        currentLocation: {
          lat,
          lng,
          timestamp: new Date(),
        },
      },
      { new: true }
    )

    if (!driver) {
      throw new AppError('Driver not found', 404)
    }

    // Store tracking history
    if (routeId) {
      await Tracking.create({
        driverId: driver._id,
        routeId,
        location: { lat, lng },
        speed: speed || 0,
        heading: heading || 0,
        batteryLevel,
      })
    }

    res.json({ success: true, location: driver.currentLocation })
  })
)

// GET /api/drivers/:id/tracking - Get driver's tracking history
router.get(
  '/:id/tracking',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { routeId, from, to, limit = '100' } = req.query

    const query: Record<string, unknown> = { driverId: req.params.id }
    
    if (routeId) query.routeId = routeId
    
    if (from || to) {
      query.timestamp = {}
      if (from) (query.timestamp as Record<string, Date>).$gte = new Date(from as string)
      if (to) (query.timestamp as Record<string, Date>).$lte = new Date(to as string)
    }

    const trackingData = await Tracking.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit as string, 10))

    res.json(trackingData)
  })
)

export default router
