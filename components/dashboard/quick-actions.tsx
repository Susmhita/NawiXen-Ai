'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Route,
  UserPlus,
  MapPin,
  Zap,
  BarChart,
} from 'lucide-react'

const actions = [
  {
    label: 'Create Route',
    href: '/routes/new',
    icon: Route,
    description: 'Plan a new delivery route',
  },
  {
    label: 'Add Driver',
    href: '/drivers/new',
    icon: UserPlus,
    description: 'Register a new driver',
  },
  {
    label: 'Live Tracking',
    href: '/tracking',
    icon: MapPin,
    description: 'Monitor fleet in real-time',
  },
  {
    label: 'AI Optimize',
    href: '/routes?optimize=true',
    icon: Zap,
    description: 'Optimize existing routes',
  },
  {
    label: 'View Analytics',
    href: '/analytics',
    icon: BarChart,
    description: 'Performance insights',
  },
]

export function QuickActions() {
  return (
    <div className="space-y-2">
      {actions.map((action) => (
        <Link key={action.href} href={action.href}>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-3"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <action.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <div className="font-medium">{action.label}</div>
              <div className="text-xs text-muted-foreground">{action.description}</div>
            </div>
          </Button>
        </Link>
      ))}
    </div>
  )
}
