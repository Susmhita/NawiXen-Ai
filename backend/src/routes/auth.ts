// Nawixen AI - Authentication Routes
import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { User, Company, IUser } from '../models/index.js'
import { generateTokens, verifyToken, authenticate, AuthRequest } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/error.js'

const router = Router()

// POST /api/auth/register
router.post(
  '/register',
  asyncHandler(async (req, res: Response) => {
    const { email, password, name, companyName } = req.body

    if (!email || !password || !name || !companyName) {
      throw new AppError('All fields are required', 400)
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      throw new AppError('Email already registered', 409)
    }

    // Create company
    const company = await Company.create({
      name: companyName,
      apiKey: uuidv4(),
      subscription: 'free',
      settings: {
        timezone: 'UTC',
        distanceUnit: 'km',
        currency: 'INR',
        notifications: {
          emailAlerts: true,
          smsAlerts: false,
          pushNotifications: true,
        },
      },
    })

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name,
      role: 'admin',
      companyId: company._id,
    })

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user)

    // Save refresh token
    user.refreshToken = refreshToken
    await user.save()

    res.status(201).json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      },
      accessToken,
      refreshToken,
    })
  })
)

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res: Response) => {
    const { email, password } = req.body

    if (!email || !password) {
      throw new AppError('Email and password are required', 400)
    }

    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password')

    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password', 401)
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user)

    // Save refresh token
    user.refreshToken = refreshToken
    await user.save()

    res.json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      },
      accessToken,
      refreshToken,
    })
  })
)

// POST /api/auth/refresh
router.post(
  '/refresh',
  asyncHandler(async (req, res: Response) => {
    const { refreshToken } = req.body

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400)
    }

    const payload = verifyToken(refreshToken)
    if (!payload) {
      throw new AppError('Invalid refresh token', 401)
    }

    const user = await User.findById(payload.userId).select('+refreshToken')

    if (!user || user.refreshToken !== refreshToken) {
      throw new AppError('Invalid refresh token', 401)
    }

    // Generate new tokens
    const tokens = generateTokens(user)

    // Save new refresh token
    user.refreshToken = tokens.refreshToken
    await user.save()

    res.json(tokens)
  })
)

// POST /api/auth/logout
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user) {
      req.user.refreshToken = undefined
      await req.user.save()
    }
    res.json({ message: 'Logged out successfully' })
  })
)

// GET /api/auth/me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await User.findById(req.user?._id).populate('companyId', 'name subscription')

    if (!user) {
      throw new AppError('User not found', 404)
    }

    res.json({
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      phone: user.phone,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
  })
)

// PUT /api/auth/me
router.put(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, phone, avatar } = req.body

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      { name, phone, avatar },
      { new: true, runValidators: true }
    )

    if (!user) {
      throw new AppError('User not found', 404)
    }

    res.json({
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      phone: user.phone,
      avatar: user.avatar,
    })
  })
)

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      throw new AppError('Current and new password are required', 400)
    }

    const user = await User.findById(req.user?._id).select('+password') as IUser | null

    if (!user || !(await user.comparePassword(currentPassword))) {
      throw new AppError('Current password is incorrect', 401)
    }

    user.password = newPassword
    await user.save()

    res.json({ message: 'Password changed successfully' })
  })
)

export default router
