// Nawixen AI - Authentication Middleware
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User, IUser } from '../models/index.js'

const JWT_SECRET = process.env.JWT_SECRET || 'nawixen-jwt-secret-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'

export interface JWTPayload {
  userId: string
  companyId: string
  role: string
}

export interface AuthRequest extends Request {
  user?: IUser
  jwtPayload?: JWTPayload
}

// Generate JWT tokens
export function generateTokens(user: IUser): { accessToken: string; refreshToken: string } {
  const payload: JWTPayload = {
    userId: user._id.toString(),
    companyId: user.companyId.toString(),
    role: user.role,
  }

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN })

  return { accessToken, refreshToken }
}

// Verify JWT token
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

// Authentication middleware
export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const payload = verifyToken(token)

    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    const user = await User.findById(payload.userId)

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    req.user = user
    req.jwtPayload = payload
    next()
  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

// Role-based authorization middleware
export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    next()
  }
}

// Company access middleware (ensures user can only access their company's data)
export function companyAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.jwtPayload) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  // Add companyId filter to request for use in controllers
  req.query.companyId = req.jwtPayload.companyId
  next()
}
