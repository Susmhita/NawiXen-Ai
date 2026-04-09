'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Driver, GeoLocation } from '@/lib/types'

interface TrackingMapProps {
  drivers: (Driver & { location?: GeoLocation })[]
  selectedDriver: string | null
  onSelectDriver: (id: string | null) => void
}

// Custom marker icon
function createDriverIcon(status: string, isSelected: boolean) {
  const color = status === 'on_route' ? '#f97316' : status === 'available' ? '#22c55e' : '#6b7280'
  const size = isSelected ? 40 : 30
  
  return L.divIcon({
    className: 'custom-driver-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      ">
        <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="white">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function TrackingMap({ drivers, selectedDriver, onSelectDriver }: TrackingMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Dark theme map tiles
    const darkTiles = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }
    )

    mapRef.current = L.map(containerRef.current, {
      center: [40.7128, -74.006], // NYC
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    })

    darkTiles.addTo(mapRef.current)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return

    const map = mapRef.current
    const existingMarkers = markersRef.current

    // Update or create markers
    drivers.forEach((driver) => {
      const location = driver.location || driver.currentLocation
      if (!location) return

      const isSelected = driver._id === selectedDriver
      const marker = existingMarkers.get(driver._id)

      if (marker) {
        // Update existing marker
        marker.setLatLng([location.lat, location.lng])
        marker.setIcon(createDriverIcon(driver.status, isSelected))
      } else {
        // Create new marker
        const newMarker = L.marker([location.lat, location.lng], {
          icon: createDriverIcon(driver.status, isSelected),
        })
          .addTo(map)
          .bindPopup(`
            <div style="min-width: 150px;">
              <strong>${driver.name}</strong><br/>
              <span style="color: #888;">${driver.vehiclePlate}</span><br/>
              <span style="text-transform: capitalize;">${driver.status.replace('_', ' ')}</span>
            </div>
          `)
          .on('click', () => onSelectDriver(driver._id))

        existingMarkers.set(driver._id, newMarker)
      }
    })

    // Remove markers for drivers no longer in the list
    existingMarkers.forEach((marker, id) => {
      if (!drivers.find((d) => d._id === id)) {
        marker.remove()
        existingMarkers.delete(id)
      }
    })
  }, [drivers, selectedDriver, onSelectDriver])

  // Pan to selected driver
  useEffect(() => {
    if (!mapRef.current || !selectedDriver) return

    const driver = drivers.find((d) => d._id === selectedDriver)
    const location = driver?.location || driver?.currentLocation
    
    if (location) {
      mapRef.current.flyTo([location.lat, location.lng], 15, {
        duration: 0.5,
      })
    }
  }, [selectedDriver, drivers])

  return (
    <div 
      ref={containerRef} 
      className="h-full w-full rounded-lg"
      style={{ minHeight: '400px' }}
    />
  )
}
