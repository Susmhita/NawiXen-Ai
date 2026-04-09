'use client'

import { CheckCircle, Clock, AlertCircle, Truck, MapPin } from 'lucide-react'

const activities = [
  {
    id: 1,
    type: 'delivery_complete',
    message: 'Route #1234 completed by John D.',
    time: '2 minutes ago',
    icon: CheckCircle,
    color: 'text-success',
  },
  {
    id: 2,
    type: 'route_started',
    message: 'Mike R. started Route #1238',
    time: '5 minutes ago',
    icon: Truck,
    color: 'text-primary',
  },
  {
    id: 3,
    type: 'delay',
    message: 'Route #1235 delayed - traffic congestion',
    time: '12 minutes ago',
    icon: Clock,
    color: 'text-warning',
  },
  {
    id: 4,
    type: 'anomaly',
    message: 'Unusual stop detected for Driver #45',
    time: '15 minutes ago',
    icon: AlertCircle,
    color: 'text-destructive',
  },
  {
    id: 5,
    type: 'stop_complete',
    message: 'Stop #3 completed on Route #1237',
    time: '18 minutes ago',
    icon: MapPin,
    color: 'text-chart-2',
  },
  {
    id: 6,
    type: 'delivery_complete',
    message: 'Route #1233 completed by Sarah K.',
    time: '25 minutes ago',
    icon: CheckCircle,
    color: 'text-success',
  },
]

export function RecentActivity() {
  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-4">
          <div className={`mt-0.5 ${activity.color}`}>
            <activity.icon className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm">{activity.message}</p>
            <p className="text-xs text-muted-foreground">{activity.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
