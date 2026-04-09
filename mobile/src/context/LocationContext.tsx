import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import * as Location from 'expo-location';
import { useAuth } from './AuthContext';
import { API_BASE_URL, WS_BASE_URL } from '../config';

interface LocationData {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface LocationContextType {
  location: LocationData | null;
  isTracking: boolean;
  error: string | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  requestPermissions: () => Promise<boolean>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

interface LocationProviderProps {
  children: ReactNode;
}

export function LocationProvider({ children }: LocationProviderProps) {
  const { token, user } = useAuth();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const websocket = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  // Connect WebSocket when authenticated and tracking
  useEffect(() => {
    if (isTracking && token && user) {
      connectWebSocket();
    }
    
    return () => {
      if (websocket.current) {
        websocket.current.close();
        websocket.current = null;
      }
    };
  }, [isTracking, token, user]);

  const connectWebSocket = () => {
    if (!token || !user) return;

    const ws = new WebSocket(`${WS_BASE_URL}?token=${token}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Subscribe to driver channel
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: `driver:${user.id}`,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);
        // Handle incoming messages (route updates, notifications, etc.)
      } catch (e) {
        console.error('WebSocket parse error:', e);
      }
    };

    ws.onerror = (e) => {
      console.error('WebSocket error:', e);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt reconnect after delay
      if (isTracking) {
        setTimeout(connectWebSocket, 5000);
      }
    };

    websocket.current = ws;
  };

  const sendLocationUpdate = (locationData: LocationData) => {
    if (websocket.current?.readyState === WebSocket.OPEN && user) {
      websocket.current.send(JSON.stringify({
        type: 'location_update',
        driverId: user.id,
        location: {
          lat: locationData.latitude,
          lng: locationData.longitude,
          heading: locationData.heading,
          speed: locationData.speed,
        },
        timestamp: new Date(locationData.timestamp).toISOString(),
      }));
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        setError('Location permission denied');
        return false;
      }

      // Request background permission for continuous tracking
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus !== 'granted') {
        console.log('Background location not granted, using foreground only');
      }

      setError(null);
      return true;
    } catch (e) {
      setError('Failed to request location permissions');
      return false;
    }
  };

  const startTracking = async () => {
    const hasPermission = await requestPermissions();
    
    if (!hasPermission) {
      return;
    }

    try {
      // Get initial location
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData: LocationData = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
        heading: initialLocation.coords.heading,
        speed: initialLocation.coords.speed,
        timestamp: initialLocation.timestamp,
      };

      setLocation(locationData);
      sendLocationUpdate(locationData);

      // Start watching location
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Or every 10 meters
        },
        (newLocation) => {
          const newLocationData: LocationData = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            heading: newLocation.coords.heading,
            speed: newLocation.coords.speed,
            timestamp: newLocation.timestamp,
          };

          setLocation(newLocationData);
          sendLocationUpdate(newLocationData);
        }
      );

      setIsTracking(true);
      setError(null);
    } catch (e) {
      setError('Failed to start location tracking');
      console.error('Location tracking error:', e);
    }
  };

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    if (websocket.current) {
      websocket.current.close();
      websocket.current = null;
    }

    setIsTracking(false);
  };

  return (
    <LocationContext.Provider
      value={{
        location,
        isTracking,
        error,
        startTracking,
        stopTracking,
        requestPermissions,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
