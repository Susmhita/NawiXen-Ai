// Nawixen AI Backend - Main Entry Point
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'http'
import dotenv from 'dotenv'

import { connectDatabase } from './config/database.js'
import { setupWebSocket } from './websocket/server.js'
import authRoutes from './routes/auth.js'
import routeRoutes from './routes/routes.js'
import driverRoutes from './routes/drivers.js'
import orderRoutes from './routes/orders.js'
import analyticsRoutes from './routes/analytics.js'
import aiRoutes from './routes/ai.js'
import paymentRoutes from './routes/payments.js'
import { errorHandler } from './middleware/error.js'

dotenv.config()

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 4000

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}))
app.use(morgan('combined'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/routes', routeRoutes)
app.use('/api/drivers', driverRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/payments', paymentRoutes)

// Error handling
app.use(errorHandler)

// 404 handler
app.use((_, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Start server
async function start() {
  try {
    // Connect to MongoDB
    await connectDatabase()
    console.log('Connected to MongoDB')

    // Setup WebSocket server
    setupWebSocket(server)
    console.log('WebSocket server initialized')

    server.listen(PORT, () => {
      console.log(`Nawixen API server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

start()

export default app
