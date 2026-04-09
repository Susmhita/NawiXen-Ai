// Nawixen AI - MongoDB Models
import mongoose, { Schema, Document, Model } from 'mongoose'
import bcrypt from 'bcryptjs'

// ============= User Model =============
export interface IUser extends Document {
  email: string
  password: string
  name: string
  role: 'admin' | 'dispatcher' | 'driver'
  companyId: mongoose.Types.ObjectId
  phone?: string
  avatar?: string
  refreshToken?: string
  createdAt: Date
  updatedAt: Date
  comparePassword(candidatePassword: string): Promise<boolean>
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'dispatcher', 'driver'], default: 'dispatcher' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    phone: { type: String },
    avatar: { type: String },
    refreshToken: { type: String, select: false },
  },
  { timestamps: true }
)

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password)
}

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema)

// ============= Company Model =============
export interface ICompany extends Document {
  name: string
  subscription: 'free' | 'pro' | 'enterprise'
  apiKey: string
  settings: {
    timezone: string
    distanceUnit: 'km' | 'miles'
    currency: string
    notifications: {
      emailAlerts: boolean
      smsAlerts: boolean
      pushNotifications: boolean
    }
  }
  subscriptionExpiresAt?: Date
  createdAt: Date
}

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    subscription: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    apiKey: { type: String, required: true, unique: true },
    settings: {
      timezone: { type: String, default: 'UTC' },
      distanceUnit: { type: String, enum: ['km', 'miles'], default: 'km' },
      currency: { type: String, default: 'INR' },
      notifications: {
        emailAlerts: { type: Boolean, default: true },
        smsAlerts: { type: Boolean, default: false },
        pushNotifications: { type: Boolean, default: true },
      },
    },
    subscriptionExpiresAt: { type: Date },
  },
  { timestamps: true }
)

export const Company: Model<ICompany> = mongoose.models.Company || mongoose.model<ICompany>('Company', companySchema)

// ============= Driver Model =============
export interface IDriver extends Document {
  name: string
  email: string
  phone: string
  vehicleType: 'bike' | 'car' | 'van' | 'truck'
  vehiclePlate: string
  status: 'available' | 'on_route' | 'offline' | 'break'
  currentLocation?: {
    lat: number
    lng: number
    timestamp: Date
  }
  companyId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  rating: number
  totalDeliveries: number
  createdAt: Date
}

const driverSchema = new Schema<IDriver>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    vehicleType: { type: String, enum: ['bike', 'car', 'van', 'truck'], required: true },
    vehiclePlate: { type: String, required: true },
    status: { type: String, enum: ['available', 'on_route', 'offline', 'break'], default: 'offline' },
    currentLocation: {
      lat: Number,
      lng: Number,
      timestamp: Date,
    },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, default: 5.0, min: 0, max: 5 },
    totalDeliveries: { type: Number, default: 0 },
  },
  { timestamps: true }
)

driverSchema.index({ companyId: 1, status: 1 })
driverSchema.index({ 'currentLocation.lat': 1, 'currentLocation.lng': 1 })

export const Driver: Model<IDriver> = mongoose.models.Driver || mongoose.model<IDriver>('Driver', driverSchema)

// ============= Route Model =============
export interface IStop {
  id: string
  name: string
  address: string
  location: { lat: number; lng: number }
  type: 'pickup' | 'delivery' | 'both'
  timeWindow?: { start: Date; end: Date }
  duration: number
  priority: number
  notes?: string
  status: 'pending' | 'arrived' | 'completed' | 'failed' | 'skipped'
  arrivedAt?: Date
  completedAt?: Date
  order?: number
}

export interface IRoute extends Document {
  name: string
  stops: IStop[]
  optimizedOrder?: number[]
  totalDistance: number
  totalDuration: number
  driverId?: mongoose.Types.ObjectId
  status: 'draft' | 'optimized' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  startTime?: Date
  endTime?: Date
  routeGeometry?: [number, number][]
  companyId: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const stopSchema = new Schema<IStop>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    type: { type: String, enum: ['pickup', 'delivery', 'both'], default: 'delivery' },
    timeWindow: {
      start: Date,
      end: Date,
    },
    duration: { type: Number, default: 5 },
    priority: { type: Number, default: 1, min: 1, max: 5 },
    notes: String,
    status: { type: String, enum: ['pending', 'arrived', 'completed', 'failed', 'skipped'], default: 'pending' },
    arrivedAt: Date,
    completedAt: Date,
    order: Number,
  },
  { _id: false }
)

const routeSchema = new Schema<IRoute>(
  {
    name: { type: String, required: true, trim: true },
    stops: [stopSchema],
    optimizedOrder: [Number],
    totalDistance: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
    status: {
      type: String,
      enum: ['draft', 'optimized', 'assigned', 'in_progress', 'completed', 'cancelled'],
      default: 'draft',
    },
    startTime: Date,
    endTime: Date,
    routeGeometry: [[Number]],
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
)

routeSchema.index({ companyId: 1, status: 1 })
routeSchema.index({ driverId: 1, status: 1 })

export const Route: Model<IRoute> = mongoose.models.Route || mongoose.model<IRoute>('Route', routeSchema)

// ============= Order Model =============
export interface IOrder extends Document {
  orderNumber: string
  customerId: mongoose.Types.ObjectId
  pickup: {
    address: string
    location: { lat: number; lng: number }
    contactName: string
    contactPhone: string
    instructions?: string
  }
  delivery: {
    address: string
    location: { lat: number; lng: number }
    contactName: string
    contactPhone: string
    instructions?: string
  }
  items: Array<{
    name: string
    quantity: number
    weight?: number
  }>
  status: 'pending' | 'confirmed' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
  driverId?: mongoose.Types.ObjectId
  routeId?: mongoose.Types.ObjectId
  estimatedDelivery?: Date
  actualDelivery?: Date
  price: number
  notes?: string
  companyId: mongoose.Types.ObjectId
  createdAt: Date
}

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    pickup: {
      address: { type: String, required: true },
      location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      contactName: { type: String, required: true },
      contactPhone: { type: String, required: true },
      instructions: String,
    },
    delivery: {
      address: { type: String, required: true },
      location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      contactName: { type: String, required: true },
      contactPhone: { type: String, required: true },
      instructions: String,
    },
    items: [{
      name: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      weight: Number,
    }],
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
      default: 'pending',
    },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
    routeId: { type: Schema.Types.ObjectId, ref: 'Route' },
    estimatedDelivery: Date,
    actualDelivery: Date,
    price: { type: Number, required: true, min: 0 },
    notes: String,
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
)

orderSchema.index({ companyId: 1, status: 1 })
orderSchema.index({ orderNumber: 1 })

export const Order: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', orderSchema)

// ============= Customer Model =============
export interface ICustomer extends Document {
  name: string
  email: string
  phone: string
  address: string
  companyId: mongoose.Types.ObjectId
  createdAt: Date
}

const customerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
)

export const Customer: Model<ICustomer> = mongoose.models.Customer || mongoose.model<ICustomer>('Customer', customerSchema)

// ============= Tracking Model =============
export interface ITracking extends Document {
  driverId: mongoose.Types.ObjectId
  routeId: mongoose.Types.ObjectId
  location: { lat: number; lng: number }
  speed: number
  heading: number
  timestamp: Date
  batteryLevel?: number
}

const trackingSchema = new Schema<ITracking>(
  {
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    routeId: { type: Schema.Types.ObjectId, ref: 'Route', required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    speed: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
    batteryLevel: Number,
  },
  { timestamps: false }
)

trackingSchema.index({ driverId: 1, timestamp: -1 })
trackingSchema.index({ routeId: 1, timestamp: -1 })
// TTL index to auto-delete old tracking data after 30 days
trackingSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })

export const Tracking: Model<ITracking> = mongoose.models.Tracking || mongoose.model<ITracking>('Tracking', trackingSchema)

// ============= Anomaly Model =============
export interface IAnomaly extends Document {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  driverId?: mongoose.Types.ObjectId
  routeId?: mongoose.Types.ObjectId
  location?: { lat: number; lng: number }
  resolved: boolean
  resolvedAt?: Date
  companyId: mongoose.Types.ObjectId
  createdAt: Date
}

const anomalySchema = new Schema<IAnomaly>(
  {
    type: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    message: { type: String, required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
    routeId: { type: Schema.Types.ObjectId, ref: 'Route' },
    location: {
      lat: Number,
      lng: Number,
    },
    resolved: { type: Boolean, default: false },
    resolvedAt: Date,
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
)

anomalySchema.index({ companyId: 1, resolved: 1, createdAt: -1 })

export const Anomaly: Model<IAnomaly> = mongoose.models.Anomaly || mongoose.model<IAnomaly>('Anomaly', anomalySchema)

// ============= Payment Model =============
export interface IPayment extends Document {
  razorpayOrderId: string
  razorpayPaymentId?: string
  amount: number
  currency: string
  status: 'created' | 'paid' | 'failed'
  planId: string
  companyId: mongoose.Types.ObjectId
  createdAt: Date
}

const paymentSchema = new Schema<IPayment>(
  {
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
    planId: { type: String, required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
)

export const Payment: Model<IPayment> = mongoose.models.Payment || mongoose.model<IPayment>('Payment', paymentSchema)
