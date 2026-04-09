// Nawixen AI - WebSocket Server for Real-Time Tracking
import { Server as HTTPServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { verifyToken } from '../middleware/auth.js'
import { Driver, Tracking } from '../models/index.js'

interface WSClient {
  ws: WebSocket
  userId?: string
  companyId?: string
  rooms: Set<string>
  isAlive: boolean
}

interface WSMessage {
  type: string
  payload: Record<string, unknown>
  timestamp: string
}

const clients = new Map<string, WSClient>()
const rooms = new Map<string, Set<string>>() // roomId -> Set of clientIds

export function setupWebSocket(server: HTTPServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' })

  // Heartbeat interval
  const heartbeatInterval = setInterval(() => {
    clients.forEach((client, clientId) => {
      if (!client.isAlive) {
        client.ws.terminate()
        clients.delete(clientId)
        return
      }
      client.isAlive = false
      client.ws.ping()
    })
  }, 30000)

  wss.on('close', () => {
    clearInterval(heartbeatInterval)
  })

  wss.on('connection', (ws, req) => {
    const clientId = generateClientId()
    const client: WSClient = {
      ws,
      rooms: new Set(),
      isAlive: true,
    }

    // Parse token from query string
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const token = url.searchParams.get('token')

    if (token) {
      const payload = verifyToken(token)
      if (payload) {
        client.userId = payload.userId
        client.companyId = payload.companyId
        
        // Auto-join company room
        const companyRoom = `company:${payload.companyId}`
        client.rooms.add(companyRoom)
        addToRoom(companyRoom, clientId)
      }
    }

    clients.set(clientId, client)

    ws.on('pong', () => {
      client.isAlive = true
    })

    ws.on('message', async (data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString())
        await handleMessage(clientId, message)
      } catch (error) {
        console.error('WebSocket message error:', error)
        sendError(ws, 'Invalid message format')
      }
    })

    ws.on('close', () => {
      // Remove from all rooms
      client.rooms.forEach(room => {
        removeFromRoom(room, clientId)
      })
      clients.delete(clientId)
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
    })

    // Send welcome message
    sendToClient(ws, {
      type: 'connected',
      payload: { clientId, authenticated: !!client.userId },
      timestamp: new Date().toISOString(),
    })
  })

  return wss
}

async function handleMessage(clientId: string, message: WSMessage) {
  const client = clients.get(clientId)
  if (!client) return

  switch (message.type) {
    case 'ping':
      sendToClient(client.ws, {
        type: 'pong',
        payload: {},
        timestamp: new Date().toISOString(),
      })
      break

    case 'location_update':
      await handleLocationUpdate(clientId, message.payload)
      break

    case 'join_room':
      handleJoinRoom(clientId, message.payload.room as string)
      break

    case 'leave_room':
      handleLeaveRoom(clientId, message.payload.room as string)
      break

    case 'chat_message':
      if (message.payload.action === 'join') {
        handleJoinRoom(clientId, message.payload.room as string)
      } else if (message.payload.action === 'leave') {
        handleLeaveRoom(clientId, message.payload.room as string)
      }
      break

    default:
      console.warn('Unknown message type:', message.type)
  }
}

async function handleLocationUpdate(
  clientId: string,
  payload: Record<string, unknown>
) {
  const client = clients.get(clientId)
  if (!client || !client.userId) return

  const { driverId, routeId, lat, lng, speed, heading, batteryLevel } = payload

  if (!driverId || typeof lat !== 'number' || typeof lng !== 'number') {
    return
  }

  // Update driver location in database
  try {
    await Driver.findByIdAndUpdate(driverId, {
      currentLocation: {
        lat,
        lng,
        timestamp: new Date(),
      },
    })

    // Store tracking record
    if (routeId) {
      await Tracking.create({
        driverId,
        routeId,
        location: { lat, lng },
        speed: (speed as number) || 0,
        heading: (heading as number) || 0,
        batteryLevel: batteryLevel as number,
      })
    }

    // Broadcast to company room
    const companyRoom = `company:${client.companyId}`
    broadcastToRoom(companyRoom, {
      type: 'location_update',
      payload: {
        driverId,
        routeId,
        location: { lat, lng },
        speed,
        heading,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    })

    // Broadcast to route room if exists
    if (routeId) {
      broadcastToRoom(`route:${routeId}`, {
        type: 'location_update',
        payload: {
          driverId,
          routeId,
          location: { lat, lng },
          speed,
          heading,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error('Error updating location:', error)
  }
}

function handleJoinRoom(clientId: string, room: string) {
  const client = clients.get(clientId)
  if (!client || !room) return

  // Verify access (basic check - could be enhanced)
  if (room.startsWith('company:') && room !== `company:${client.companyId}`) {
    sendError(client.ws, 'Not authorized to join this room')
    return
  }

  client.rooms.add(room)
  addToRoom(room, clientId)

  sendToClient(client.ws, {
    type: 'room_joined',
    payload: { room },
    timestamp: new Date().toISOString(),
  })
}

function handleLeaveRoom(clientId: string, room: string) {
  const client = clients.get(clientId)
  if (!client || !room) return

  client.rooms.delete(room)
  removeFromRoom(room, clientId)

  sendToClient(client.ws, {
    type: 'room_left',
    payload: { room },
    timestamp: new Date().toISOString(),
  })
}

function addToRoom(room: string, clientId: string) {
  if (!rooms.has(room)) {
    rooms.set(room, new Set())
  }
  rooms.get(room)!.add(clientId)
}

function removeFromRoom(room: string, clientId: string) {
  const roomClients = rooms.get(room)
  if (roomClients) {
    roomClients.delete(clientId)
    if (roomClients.size === 0) {
      rooms.delete(room)
    }
  }
}

function broadcastToRoom(room: string, message: WSMessage, excludeClientId?: string) {
  const roomClients = rooms.get(room)
  if (!roomClients) return

  roomClients.forEach(clientId => {
    if (clientId !== excludeClientId) {
      const client = clients.get(clientId)
      if (client && client.ws.readyState === WebSocket.OPEN) {
        sendToClient(client.ws, message)
      }
    }
  })
}

function sendToClient(ws: WebSocket, message: WSMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

function sendError(ws: WebSocket, error: string) {
  sendToClient(ws, {
    type: 'error',
    payload: { error },
    timestamp: new Date().toISOString(),
  })
}

function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// Export broadcast function for use by other modules
export function broadcast(companyId: string, message: WSMessage) {
  broadcastToRoom(`company:${companyId}`, message)
}

export function broadcastToRoute(routeId: string, message: WSMessage) {
  broadcastToRoom(`route:${routeId}`, message)
}
