// Nawixen AI - Payment Routes (Razorpay Integration)
import { Router, Response } from 'express'
import crypto from 'crypto'
import { Payment, Company } from '../models/index.js'
import { authenticate, companyAccess, AuthRequest } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/error.js'

const router = Router()

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || ''
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || ''

// Subscription plans
const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Free',
    tier: 'free',
    price: 0,
    currency: 'INR',
    interval: 'monthly',
    features: [
      '10 routes per month',
      '2 drivers included',
      'Basic route planning',
      'Email support',
    ],
    limits: {
      routesPerMonth: 10,
      driversIncluded: 2,
      aiOptimizations: 5,
      realTimeTracking: false,
      analytics: false,
      apiAccess: false,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    tier: 'pro',
    price: 2999,
    currency: 'INR',
    interval: 'monthly',
    features: [
      '500 routes per month',
      '10 drivers included',
      'AI-powered route optimization',
      'Real-time tracking',
      'Basic analytics',
      'Priority support',
    ],
    limits: {
      routesPerMonth: 500,
      driversIncluded: 10,
      aiOptimizations: 100,
      realTimeTracking: true,
      analytics: true,
      apiAccess: false,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 'enterprise',
    price: 9999,
    currency: 'INR',
    interval: 'monthly',
    features: [
      'Unlimited routes',
      'Unlimited drivers',
      'Advanced AI analytics',
      'Real-time tracking',
      'Demand forecasting',
      'Anomaly detection',
      'API access',
      'Dedicated support',
    ],
    limits: {
      routesPerMonth: -1, // Unlimited
      driversIncluded: -1,
      aiOptimizations: -1,
      realTimeTracking: true,
      analytics: true,
      apiAccess: true,
    },
  },
]

// GET /api/payments/plans - Get available plans
router.get('/plans', (_, res: Response) => {
  res.json(SUBSCRIPTION_PLANS)
})

// Apply auth to remaining routes
router.use(authenticate, companyAccess)

// GET /api/payments/subscription - Get current subscription
router.get(
  '/subscription',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const company = await Company.findById(req.jwtPayload?.companyId)

    if (!company) {
      throw new AppError('Company not found', 404)
    }

    const plan = SUBSCRIPTION_PLANS.find(p => p.tier === company.subscription)

    res.json({
      plan,
      expiresAt: company.subscriptionExpiresAt,
    })
  })
)

// POST /api/payments/create-order - Create Razorpay order
router.post(
  '/create-order',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { planId } = req.body

    if (!planId) {
      throw new AppError('Plan ID is required', 400)
    }

    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId)
    if (!plan) {
      throw new AppError('Invalid plan', 400)
    }

    if (plan.price === 0) {
      throw new AppError('Cannot create order for free plan', 400)
    }

    // Create Razorpay order
    const orderData = {
      amount: plan.price * 100, // Amount in paise
      currency: plan.currency,
      receipt: `order_${Date.now()}`,
      notes: {
        planId,
        companyId: req.jwtPayload?.companyId,
      },
    }

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify(orderData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new AppError(error.error?.description || 'Failed to create order', 500)
    }

    const razorpayOrder = await response.json()

    // Save payment record
    await Payment.create({
      razorpayOrderId: razorpayOrder.id,
      amount: plan.price,
      currency: plan.currency,
      status: 'created',
      planId,
      companyId: req.jwtPayload?.companyId,
    })

    res.json({
      id: razorpayOrder.id,
      razorpayOrderId: razorpayOrder.id,
      amount: plan.price,
      currency: plan.currency,
      status: 'created',
      planId,
      key: RAZORPAY_KEY_ID,
    })
  })
)

// POST /api/payments/verify - Verify payment signature
router.post(
  '/verify',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orderId, paymentId, signature } = req.body

    if (!orderId || !paymentId || !signature) {
      throw new AppError('Missing required fields', 400)
    }

    // Verify signature
    const body = orderId + '|' + paymentId
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex')

    if (expectedSignature !== signature) {
      throw new AppError('Invalid payment signature', 400)
    }

    // Update payment record
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: orderId },
      {
        razorpayPaymentId: paymentId,
        status: 'paid',
      },
      { new: true }
    )

    if (!payment) {
      throw new AppError('Payment not found', 404)
    }

    // Update company subscription
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === payment.planId)
    if (plan) {
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + 1)

      await Company.findByIdAndUpdate(payment.companyId, {
        subscription: plan.tier,
        subscriptionExpiresAt: expiresAt,
      })
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
    })
  })
)

// GET /api/payments/invoices - Get payment history
router.get(
  '/invoices',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const payments = await Payment.find({
      companyId: req.jwtPayload?.companyId,
      status: 'paid',
    })
      .sort({ createdAt: -1 })
      .limit(20)

    const invoices = payments.map((payment, index) => ({
      id: payment._id,
      invoiceNumber: `INV-${payment.createdAt.getFullYear()}-${String(index + 1).padStart(4, '0')}`,
      companyId: payment.companyId,
      amount: payment.amount,
      currency: payment.currency,
      status: 'paid',
      dueDate: payment.createdAt,
      paidAt: payment.createdAt,
      items: [
        {
          description: `Nawixen ${SUBSCRIPTION_PLANS.find(p => p.id === payment.planId)?.name || 'Pro'} Plan - Monthly`,
          quantity: 1,
          unitPrice: payment.amount,
          total: payment.amount,
        },
      ],
    }))

    res.json(invoices)
  })
)

// Webhook endpoint (no auth required)
router.post('/webhook', asyncHandler(async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

  if (webhookSecret) {
    const signature = req.headers['x-razorpay-signature']
    const body = JSON.stringify(req.body)

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex')

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: 'Invalid webhook signature' })
    }
  }

  const event = req.body

  switch (event.event) {
    case 'payment.captured':
      // Payment successful
      const paymentData = event.payload.payment.entity
      await Payment.findOneAndUpdate(
        { razorpayOrderId: paymentData.order_id },
        {
          razorpayPaymentId: paymentData.id,
          status: 'paid',
        }
      )
      break

    case 'payment.failed':
      // Payment failed
      const failedPayment = event.payload.payment.entity
      await Payment.findOneAndUpdate(
        { razorpayOrderId: failedPayment.order_id },
        { status: 'failed' }
      )
      break
  }

  res.json({ received: true })
}))

export default router
