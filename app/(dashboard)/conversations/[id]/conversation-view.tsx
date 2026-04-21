'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Send, CheckCircle, AlertTriangle, MessageSquare, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import type { Conversation, Message } from '@/types'
import Link from 'next/link'

interface ConversationViewProps {
  conversation: Conversation
  initialMessages: Message[]
}

const statusConfig = {
  active: { label: 'Activa', variant: 'default' as const },
  escalated: { label: 'Escalada', variant: 'destructive' as const },
  resolved: { label: 'Resuelta', variant: 'secondary' as const },
}

export function ConversationView({ conversation: initialConv, initialMessages }: ConversationViewProps) {
  const router = useRouter()
  const [conv, setConv] = useState(initialConv)
  const [messages, setMessages] = useState(initialMessages)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const refreshMessages = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`)
      if (res.ok) {
        const data = await res.json() as { conversation: Conversation; messages: Message[] }
        setConv(data.conversation)
        setMessages(data.messages)
      }
    } finally {
      if (showSpinner) setRefreshing(false)
    }
  }, [conv.id])

  // Poll every 8 seconds when conversation is active or escalated
  useEffect(() => {
    if (conv.status === 'resolved') return
    const interval = setInterval(() => refreshMessages(), 8000)
    return () => clearInterval(interval)
  }, [conv.status, refreshMessages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = messageText.trim()
    if (!text || sending) return

    setSending(true)
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conv.id, message: text }),
      })

      if (!res.ok) throw new Error('Error al enviar')

      setMessageText('')
      await refreshMessages(false)
      toast.success('Mensaje enviado')
    } catch {
      toast.error('No se pudo enviar el mensaje')
    } finally {
      setSending(false)
    }
  }

  async function changeStatus(newStatus: 'active' | 'escalated' | 'resolved') {
    setChangingStatus(true)
    try {
      const res = await fetch('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conv.id, status: newStatus }),
      })

      if (!res.ok) throw new Error()

      setConv((prev) => ({ ...prev, status: newStatus }))
      router.refresh()

      const labels = { active: 'activa', escalated: 'escalada', resolved: 'resuelta' }
      toast.success(`Conversación marcada como ${labels[newStatus]}`)
    } catch {
      toast.error('No se pudo cambiar el estado')
    } finally {
      setChangingStatus(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e as unknown as React.FormEvent)
    }
  }

  const cfg = statusConfig[conv.status]

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/conversations">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{conv.contact_name || conv.phone}</h1>
            {conv.contact_name && (
              <p className="text-sm text-muted-foreground">{conv.phone}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => refreshMessages(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Status actions */}
      <div className="flex gap-2 flex-wrap">
        {conv.status === 'escalated' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => changeStatus('active')}
            disabled={changingStatus}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Tomar control (reactivar bot)
          </Button>
        )}
        {conv.status === 'active' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => changeStatus('escalated')}
            disabled={changingStatus}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Escalar a humano
          </Button>
        )}
        {conv.status !== 'resolved' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => changeStatus('resolved')}
            disabled={changingStatus}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Marcar resuelta
          </Button>
        )}
        {conv.status === 'resolved' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => changeStatus('active')}
            disabled={changingStatus}
          >
            Reabrir conversación
          </Button>
        )}
      </div>

      {/* Messages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Historial · {messages.length} mensaje{messages.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[55vh] overflow-y-auto pr-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin mensajes</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-muted'
                      : msg.role === 'human'
                      ? 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-100'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  {msg.role === 'human' && (
                    <p className="text-xs font-medium mb-1 opacity-70">Equipo humano</p>
                  )}
                  {msg.role === 'assistant' && (
                    <p className="text-xs font-medium mb-1 opacity-70">Bot</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className="text-xs opacity-60 mt-1 text-right">
                    {new Date(msg.created_at).toLocaleTimeString('es', { timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>

      {/* Send message form */}
      {conv.status !== 'resolved' && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={sendMessage} className="flex gap-2 items-end">
              <div className="flex-1">
                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe un mensaje como equipo humano… (Enter para enviar, Shift+Enter nueva línea)"
                  rows={2}
                  disabled={sending}
                  className="resize-none"
                />
              </div>
              <Button type="submit" disabled={sending || !messageText.trim()} size="sm">
                <Send className="h-3.5 w-3.5" />
                {sending ? 'Enviando…' : 'Enviar'}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              Los mensajes enviados aquí se etiquetan como &ldquo;Equipo humano&rdquo; y se envían vía WhatsApp.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
