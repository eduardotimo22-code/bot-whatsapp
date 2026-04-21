'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageSquare, AlertTriangle, CheckCircle, RefreshCw, Search } from 'lucide-react'
import type { Conversation } from '@/types'
import Link from 'next/link'

type ConversationWithLast = Conversation & { last_message: string }
type StatusFilter = 'all' | 'active' | 'escalated' | 'resolved'

const statusConfig = {
  active:   { label: 'Activa',   variant: 'default'     as const, icon: MessageSquare },
  escalated:{ label: 'Escalada', variant: 'destructive' as const, icon: AlertTriangle },
  resolved: { label: 'Resuelta', variant: 'secondary'   as const, icon: CheckCircle  },
}

const filterTabs: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'Todas'    },
  { key: 'active',    label: 'Activas'  },
  { key: 'escalated', label: 'Escaladas'},
  { key: 'resolved',  label: 'Resueltas'},
]

export function ConversationsList({ initial }: { initial: ConversationWithLast[] }) {
  const [conversations, setConversations] = useState(initial)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)

  const fetchConversations = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const res = await fetch('/api/conversations')
      if (res.ok) {
        setConversations(await res.json() as ConversationWithLast[])
        setLastUpdated(new Date())
      }
    } catch {
      // network error — keep showing last known data
    } finally {
      if (showSpinner) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => fetchConversations(), 10_000)
    return () => clearInterval(id)
  }, [fetchConversations])

  const counts = {
    all:       conversations.length,
    active:    conversations.filter((c) => c.status === 'active').length,
    escalated: conversations.filter((c) => c.status === 'escalated').length,
    resolved:  conversations.filter((c) => c.status === 'resolved').length,
  }

  const byStatus = filter === 'all' ? conversations : conversations.filter((c) => c.status === filter)
  const q = search.trim().toLowerCase()
  const visible = q
    ? byStatus.filter(
        (c) =>
          (c.contact_name ?? '').toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.last_message ?? '').toLowerCase().includes(q)
      )
    : byStatus

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Conversaciones</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {conversations.length} en total
            {counts.escalated > 0 && (
              <span className="ml-2 text-destructive font-medium">
                · {counts.escalated} escalada{counts.escalated > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {lastUpdated.toLocaleTimeString('es', { timeStyle: 'short' })}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fetchConversations(true)}
            disabled={refreshing}
            title="Actualizar ahora"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {filterTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors border ${
              filter === key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 py-0 text-xs leading-5 ${
                filter === key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
              } ${key === 'escalated' && counts.escalated > 0 && filter !== key ? '!bg-destructive/15 !text-destructive' : ''}`}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono o mensaje…"
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-30" />
            {conversations.length === 0 ? (
              <>
                <p>No hay conversaciones aún.</p>
                <p className="text-xs mt-1">Los chats de WhatsApp aparecerán aquí automáticamente.</p>
              </>
            ) : (
              <p>No hay conversaciones {filterTabs.find((t) => t.key === filter)?.label.toLowerCase()}.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((conv) => {
            const cfg = statusConfig[conv.status]
            return (
              <Link key={conv.id} href={`/conversations/${conv.id}`}>
                <Card
                  className={`hover:bg-accent/50 transition-colors cursor-pointer ${
                    conv.status === 'escalated' ? 'border-destructive/40' : ''
                  }`}
                >
                  <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{conv.contact_name || conv.phone}</span>
                        {conv.contact_name && (
                          <span className="text-xs text-muted-foreground">{conv.phone}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.last_message || 'Sin mensajes'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {conv.last_message_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(conv.last_message_at).toLocaleString('es', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      )}
                      <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
