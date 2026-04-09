// API Configuration
// In production, replace with your actual backend URLs

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
export const WS_BASE_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:5000/ws';
export const AI_ENGINE_URL = process.env.EXPO_PUBLIC_AI_URL || 'http://localhost:8000';

// App Configuration
export const APP_CONFIG = {
  // Location tracking interval in milliseconds
  LOCATION_UPDATE_INTERVAL: 5000,
  
  // Distance threshold for location updates (meters)
  LOCATION_DISTANCE_THRESHOLD: 10,
  
  // WebSocket reconnect delay (milliseconds)
  WS_RECONNECT_DELAY: 5000,
  
  // API request timeout (milliseconds)
  API_TIMEOUT: 30000,
  
  // Map default region (Mumbai, India)
  DEFAULT_REGION: {
    latitude: 19.076,
    longitude: 72.8777,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  },
};

// Theme colors (matching web dashboard)
export const COLORS = {
  primary: '#f97316',       // Orange
  primaryDark: '#ea580c',
  background: '#0f172a',    // Navy blue
  card: '#1e293b',
  cardDark: '#0f172a',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  border: '#334155',
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  info: '#3b82f6',
};
