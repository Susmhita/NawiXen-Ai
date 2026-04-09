"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  GripVertical,
  MapPin,
  Plus,
  Trash2,
  Navigation,
  Clock,
  Route as RouteIcon,
  Sparkles,
  ArrowUpDown,
} from "lucide-react"

interface Stop {
  id: string
  address: string
  type: "pickup" | "delivery"
  lat?: number
  lng?: number
  eta?: string
  priority?: "low" | "normal" | "high" | "urgent"
}

interface RouteBuilderProps {
  onOptimize?: (stops: Stop[]) => void
  onSave?: (stops: Stop[]) => void
}

export function RouteBuilder({ onOptimize, onSave }: RouteBuilderProps) {
  const [stops, setStops] = useState<Stop[]>([
    { id: "1", address: "", type: "pickup", priority: "normal" },
    { id: "2", address: "", type: "delivery", priority: "normal" },
  ])
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<string>("")

  const addStop = () => {
    const newStop: Stop = {
      id: Date.now().toString(),
      address: "",
      type: "delivery",
      priority: "normal",
    }
    setStops([...stops, newStop])
  }

  const removeStop = (id: string) => {
    if (stops.length > 2) {
      setStops(stops.filter((stop) => stop.id !== id))
    }
  }

  const updateStop = (id: string, field: keyof Stop, value: string) => {
    setStops(
      stops.map((stop) =>
        stop.id === id ? { ...stop, [field]: value } : stop
      )
    )
  }

  const handleOptimize = async () => {
    setIsOptimizing(true)
    // Simulate AI optimization
    await new Promise((resolve) => setTimeout(resolve, 1500))
    
    // Mock optimized order (in real app, this would come from the AI engine)
    const optimizedStops = [...stops].sort((a, b) => {
      if (a.type === "pickup") return -1
      if (b.type === "pickup") return 1
      return 0
    })
    
    setStops(optimizedStops)
    setIsOptimizing(false)
    onOptimize?.(optimizedStops)
  }

  const handleSave = () => {
    onSave?.(stops)
  }

  const moveStop = (index: number, direction: "up" | "down") => {
    const newStops = [...stops]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= stops.length) return
    ;[newStops[index], newStops[targetIndex]] = [newStops[targetIndex], newStops[index]]
    setStops(newStops)
  }

  const totalStops = stops.filter((s) => s.address.trim()).length
  const pickupCount = stops.filter((s) => s.type === "pickup" && s.address.trim()).length
  const deliveryCount = stops.filter((s) => s.type === "delivery" && s.address.trim()).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RouteIcon className="h-5 w-5 text-primary" />
              Route Builder
            </CardTitle>
            <CardDescription>Add stops and optimize your delivery route</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{totalStops} stops</Badge>
            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
              {pickupCount} pickups
            </Badge>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              {deliveryCount} deliveries
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Driver Selection */}
        <div className="flex flex-col gap-2">
          <Label>Assign Driver</Label>
          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Select a driver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="driver1">Rajesh Kumar - Van (Available)</SelectItem>
              <SelectItem value="driver2">Amit Sharma - Truck (Available)</SelectItem>
              <SelectItem value="driver3">Meena Singh - Truck (Available)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stops List */}
        <div className="flex flex-col gap-3">
          {stops.map((stop, index) => (
            <div
              key={stop.id}
              className="flex items-start gap-3 rounded-lg border bg-card/50 p-4"
            >
              <div className="flex flex-col items-center gap-1 pt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveStop(index, "up")}
                  disabled={index === 0}
                >
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <span className="text-xs font-medium text-muted-foreground">{index + 1}</span>
              </div>

              <div className="flex-1 grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Label className="sr-only">Address</Label>
                  <div className="relative">
                    <MapPin className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
                      stop.type === "pickup" ? "text-success" : "text-primary"
                    }`} />
                    <Input
                      placeholder="Enter address"
                      value={stop.address}
                      onChange={(e) => updateStop(stop.id, "address", e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div>
                  <Label className="sr-only">Type</Label>
                  <Select
                    value={stop.type}
                    onValueChange={(value) => updateStop(stop.id, "type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pickup">Pickup</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="sr-only">Priority</Label>
                  <Select
                    value={stop.priority}
                    onValueChange={(value) => updateStop(stop.id, "priority", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeStop(stop.id)}
                disabled={stops.length <= 2}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add Stop Button */}
        <Button variant="outline" onClick={addStop} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Stop
        </Button>

        {/* Route Summary */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <h4 className="text-sm font-medium mb-3">Route Summary</h4>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Estimated Distance</p>
                <p className="font-medium">{totalStops > 0 ? `~${totalStops * 5} km` : "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Estimated Time</p>
                <p className="font-medium">{totalStops > 0 ? `~${totalStops * 15} min` : "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RouteIcon className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Stops</p>
                <p className="font-medium">{totalStops}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 md:flex-row md:justify-end">
          <Button
            variant="outline"
            onClick={handleOptimize}
            disabled={isOptimizing || totalStops < 2}
          >
            <Sparkles className={`mr-2 h-4 w-4 ${isOptimizing ? "animate-pulse" : ""}`} />
            {isOptimizing ? "Optimizing..." : "AI Optimize Route"}
          </Button>
          <Button onClick={handleSave} disabled={totalStops < 2 || !selectedDriver}>
            Create Route
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
