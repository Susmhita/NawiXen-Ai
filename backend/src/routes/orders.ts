// Nawixen AI - Order Management Routes
import { Router, Response } from 'express'
import { Order, Customer } from '../models/index.js'
import { authenticate, companyAccess, AuthRequest } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/error.js'

const router = Router()

router.use(authenticate, companyAccess)

// Generate order number
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `NWX-${timestamp}-${random}`
}

// GET /api/orders - List all orders
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

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('customerId', 'name email phone')
        .populate('driverId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments(query),
    ])

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  })
)

// GET /api/orders/:id - Get single order
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await Order.findOne({
      _id: req.params.id,
      companyId: req.jwtPayload?.companyId,
    })
      .populate('customerId', 'name email phone address')
      .populate('driverId', 'name phone vehicleType currentLocation')
      .populate('routeId', 'name status')

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    res.json(order)
  })
)

// POST /api/orders - Create new order
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { customer, pickup, delivery, items, price, notes } = req.body

    if (!customer || !pickup || !delivery || !items || !price) {
      throw new AppError('Missing required fields', 400)
    }

    // Find or create customer
    let customerId
    if (customer._id) {
      customerId = customer._id
    } else {
      const newCustomer = await Customer.create({
        ...customer,
        companyId: req.jwtPayload?.companyId,
      })
      customerId = newCustomer._id
    }

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      customerId,
      pickup,
      delivery,
      items,
      price,
      notes,
      companyId: req.jwtPayload?.companyId,
      status: 'pending',
    })

    res.status(201).json(order)
  })
)

// PUT /api/orders/:id - Update order
router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { pickup, delivery, items, price, notes, status } = req.body

    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.jwtPayload?.companyId,
      },
      { pickup, delivery, items, price, notes, status },
      { new: true, runValidators: true }
    )

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    res.json(order)
  })
)

// POST /api/orders/:id/cancel - Cancel order
router.post(
  '/:id/cancel',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { reason } = req.body

    const order = await Order.findOne({
      _id: req.params.id,
      companyId: req.jwtPayload?.companyId,
    })

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    if (['delivered', 'cancelled'].includes(order.status)) {
      throw new AppError('Cannot cancel this order', 400)
    }

    order.status = 'cancelled'
    order.notes = reason ? `${order.notes || ''}\nCancellation reason: ${reason}`.trim() : order.notes
    await order.save()

    res.json(order)
  })
)

// PATCH /api/orders/:id/status - Update order status
router.patch(
  '/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status } = req.body

    const validStatuses = ['pending', 'confirmed', 'picked_up', 'in_transit', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid status', 400)
    }

    const updateData: Record<string, unknown> = { status }
    
    if (status === 'delivered') {
      updateData.actualDelivery = new Date()
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.jwtPayload?.companyId,
      },
      updateData,
      { new: true }
    )

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    res.json(order)
  })
)

// GET /api/orders/customer/:customerId - Get orders by customer
router.get(
  '/customer/:customerId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orders = await Order.find({
      customerId: req.params.customerId,
      companyId: req.jwtPayload?.companyId,
    })
      .sort({ createdAt: -1 })
      .limit(50)

    res.json(orders)
  })
)

export default router
