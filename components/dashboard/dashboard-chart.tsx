'use client'

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const data = [
  { date: 'Mon', deliveries: 45, distance: 280 },
  { date: 'Tue', deliveries: 52, distance: 320 },
  { date: 'Wed', deliveries: 48, distance: 295 },
  { date: 'Thu', deliveries: 61, distance: 380 },
  { date: 'Fri', deliveries: 55, distance: 340 },
  { date: 'Sat', deliveries: 38, distance: 220 },
  { date: 'Sun', deliveries: 28, distance: 165 },
]

export function DashboardChart() {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="deliveriesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="distanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--foreground))',
            }}
          />
          <Area
            type="monotone"
            dataKey="deliveries"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#deliveriesGradient)"
            name="Deliveries"
          />
          <Area
            type="monotone"
            dataKey="distance"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            fill="url(#distanceGradient)"
            name="Distance (km)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
