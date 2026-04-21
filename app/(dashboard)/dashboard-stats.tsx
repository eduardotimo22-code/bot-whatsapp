'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, AlertTriangle, Users, Calendar, TrendingUp } from 'lucide-react'
import type { DashboardStats } from '@/types'
import Link from 'next/link'

interface DashboardStatsProps {
  initial: DashboardStats
}

export function DashboardStatsView({ initial }: DashboardStatsProps) {
  const [stats, setStats] = useState(initial)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      if (res.ok) setStats(await res.json() as DashboardStats)
    } catch {
      // network error — keep showing last known data
    }
  }, [])

  useEffect(() => {
    const id = setInterval(fetchStats, 15_000)
    return () => clearInterval(id)
  }, [fetchStats])

  const cards = [
    {
      title: 'Conversaciones activas',
      value: stats.active_conversations,
      icon: MessageSquare,
      description: 'Chats en curso',
      href: '/conversations',
    },
    {
      title: 'Escaladas',
      value: stats.escalated_conversations,
      icon: AlertTriangle,
      description: 'Requieren atención humana',
      highlight: stats.escalated_conversations > 0,
      href: '/conversations',
    },
    {
      title: 'Contactos / Leads',
      value: stats.total_contacts,
      icon: Users,
      description: 'Total registrados',
      href: '/contacts',
    },
    {
      title: 'Mensajes hoy',
      value: stats.messages_today,
      icon: TrendingUp,
      description: 'Enviados y recibidos',
    },
    {
      title: 'Envíos programados',
      value: stats.pending_jobs,
      icon: Calendar,
      description: 'En cola',
      href: '/scheduler',
    },
  ]

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((card) => {
          const inner = (
            <Card
              key={card.title}
              className={`${card.highlight ? 'border-destructive' : ''} ${card.href ? 'hover:bg-accent/40 transition-colors cursor-pointer' : ''}`}
            >
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className={`h-4 w-4 ${card.highlight ? 'text-destructive' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold">{card.value}</span>
                  {card.highlight && <Badge variant="destructive">!</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              </CardContent>
            </Card>
          )
          return card.href ? (
            <Link key={card.title} href={card.href}>
              {inner}
            </Link>
          ) : (
            <div key={card.title}>{inner}</div>
          )
        })}
      </div>

      {stats.escalated_conversations > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-medium">
                Hay {stats.escalated_conversations} conversación
                {stats.escalated_conversations > 1 ? 'es' : ''} escalada
                {stats.escalated_conversations > 1 ? 's' : ''} esperando atención.
              </p>
            </div>
            <Link href="/conversations" className="text-sm text-primary underline mt-1 inline-block">
              Ver conversaciones →
            </Link>
          </CardContent>
        </Card>
      )}
    </>
  )
}
