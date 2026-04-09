// Nawixen AI - Analytics Routes
import { Router, Response } from 'express'
import { Route, Driver, Order, Anomaly } from '../models/index.js'
import { authenticate, companyAccess, AuthRequest } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'

const router = Router()

router.use(authenticate, companyAccess)

// GET /api/analytics/dashboard - Get dashboard stats
router.get(
  '/dashboard',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.jwtPayload?.companyId

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      totalDrivers,
      activeDrivers,
      activeRoutes,
      completedToday,
      deliveriesInProgress,
      pendingOrders,
      anomalyAlerts,
      routeStats,
    ] = await Promise.all([
      Driver.countDocuments({ companyId }),
      Driver.countDocuments({ companyId, status: { $in: ['available', 'on_route'] } }),
      Route.countDocuments({ companyId, status: 'in_progress' }),
      Route.countDocuments({ companyId, status: 'completed', endTime: { $gte: today } }),
      Order.countDocuments({ companyId, status: 'in_transit' }),
      Order.countDocuments({ companyId, status: 'pending' }),
      Anomaly.countDocuments({ companyId, resolved: false }),
      Route.aggregate([
        {
          $match: {
            companyId: companyId,
            status: 'completed',
            endTime: { $gte: today },
          },
        },
        {
          $group: {
            _id: null,
            totalDistance: { $sum: '$totalDistance' },
            totalDuration: { $sum: '$totalDuration' },
            avgDuration: { $avg: '$totalDuration' },
          },
        },
      ]),
    ])

    // Calculate on-time rate (simplified)
    const completedRoutes = await Route.find({
      companyId,
      status: 'completed',
      endTime: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    }).select('startTime endTime totalDuration')

    let onTimeRate = 95 // Default
    if (completedRoutes.length > 0) {
      const onTimeCount = completedRoutes.filter(route => {
        if (!route.startTime || !route.endTime) return true
        const actualDuration = route.endTime.getTime() - route.startTime.getTime()
        const expectedDuration = route.totalDuration * 1000 * 1.2 // 20% buffer
        return actualDuration <= expectedDuration
      }).length
      onTimeRate = Math.round((onTimeCount / completedRoutes.length) * 100)
    }

    res.json({
      activeDrivers,
      totalDrivers,
      activeRoutes,
      completedToday,
      deliveriesInProgress,
      onTimeRate,
      avgDeliveryTime: routeStats[0]?.avgDuration || 0,
      totalDistanceToday: routeStats[0]?.totalDistance || 0,
      anomalyAlerts,
      pendingOrders,
    })
  })
)

// GET /api/analytics/performance - Get performance metrics
router.get(
  '/performance',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.jwtPayload?.companyId
    const { period = 'week' } = req.query

    let startDate: Date
    switch (period) {
      case 'day':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'year':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }

    const [routeStats, driverStats, orderStats] = await Promise.all([
      Route.aggregate([
        {
          $match: {
            companyId,
            status: 'completed',
            endTime: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            totalDeliveries: { $sum: { $size: '$stops' } },
            totalDistance: { $sum: '$totalDistance' },
            avgDeliveryTime: { $avg: '$totalDuration' },
          },
        },
      ]),
      Driver.aggregate([
        { $match: { companyId } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            totalDeliveries: { $sum: '$totalDeliveries' },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            companyId,
            status: 'delivered',
            actualDelivery: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$price' },
          },
        },
      ]),
    ])

    res.json({
      totalDeliveries: routeStats[0]?.totalDeliveries || 0,
      onTimeRate: 92, // Placeholder - implement actual calculation
      avgDeliveryTime: Math.round((routeStats[0]?.avgDeliveryTime || 0) / 60), // Convert to minutes
      totalDistance: Math.round((routeStats[0]?.totalDistance || 0) / 1000), // Convert to km
      customerRating: driverStats[0]?.avgRating || 5,
      totalOrders: orderStats[0]?.totalOrders || 0,
      totalRevenue: orderStats[0]?.totalRevenue || 0,
    })
  })
)

// GET /api/analytics/demand-forecast - Get demand forecast
router.get(
  '/demand-forecast',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.jwtPayload?.companyId
    const { days = '7' } = req.query

    // Get historical order data for forecasting
    const historicalData = await Order.aggregate([
      {
        $match: {
          companyId,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // Simple moving average forecast
    const avgOrders = historicalData.length > 0
      ? historicalData.reduce((sum, d) => sum + d.count, 0) / historicalData.length
      : 10

    const forecasts = []
    for (let i = 1; i <= parseInt(days as string, 10); i++) {
      const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000)
      const dayOfWeek = date.getDay()
      
      // Weekend adjustment
      const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.1
      
      forecasts.push({
        date: date.toISOString().split('T')[0],
        region: 'all',
        predictedOrders: Math.round(avgOrders * weekendFactor * (0.9 + Math.random() * 0.2)),
        confidence: 0.75 + Math.random() * 0.15,
        trend: weekendFactor > 1 ? 'up' : 'down',
      })
    }

    res.json(forecasts)
  })
)

// GET /api/analytics/anomalies - Get anomaly alerts
router.get(
  '/anomalies',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.jwtPayload?.companyId
    const { resolved } = req.query

    const query: Record<string, unknown> = { companyId }
    if (resolved !== undefined) {
      query.resolved = resolved === 'true'
    }

    const anomalies = await Anomaly.find(query)
      .populate('driverId', 'name')
      .populate('routeId', 'name')
      .sort({ createdAt: -1 })
      .limit(50)

    res.json(anomalies)
  })
)

// POST /api/analytics/anomalies/:id/resolve - Resolve anomaly
router.post(
  '/anomalies/:id/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const anomaly = await Anomaly.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.jwtPayload?.companyId,
      },
      {
        resolved: true,
        resolvedAt: new Date(),
      },
      { new: true }
    )

    if (!anomaly) {
      return res.status(404).json({ error: 'Anomaly not found' })
    }

    res.json(anomaly)
  })
)

// GET /api/analytics/chart-data - Get chart data for dashboard
router.get(
  '/chart-data',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.jwtPayload?.companyId
    const { type = 'deliveries', period = 'week' } = req.query

    let days = 7
    if (period === 'month') days = 30
    if (period === 'year') days = 365

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    let data
    switch (type) {
      case 'deliveries':
        data = await Route.aggregate([
          {
            $match: {
              companyId,
              status: 'completed',
              endTime: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$endTime' },
              },
              count: { $sum: { $size: '$stops' } },
            },
          },
          { $sort: { _id: 1 } },
        ])
        break
      case 'distance':
        data = await Route.aggregate([
          {
            $match: {
              companyId,
              status: 'completed',
              endTime: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$endTime' },
              },
              total: { $sum: { $divide: ['$totalDistance', 1000] } },
            },
          },
          { $sort: { _id: 1 } },
        ])
        break
      case 'orders':
        data = await Order.aggregate([
          {
            $match: {
              companyId,
              createdAt: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        break
      default:
        data = []
    }

    res.json(data)
  })
)

export default router
