'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { WhatsAppGroup } from '@/lib/ycloud/groups'


type TargetType = 'contact' | 'group' | 'broadcast'

export function CreateJobForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [targetType, setTargetType] = useState<TargetType>('contact')
  const [targetId, setTargetId] = useState('')
  const [targetName, setTargetName] = useState('')
  const [message, setMessage] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [groups, setGroups] = useState<WhatsAppGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)

  useEffect(() => {
    if (targetType === 'group' && groups.length === 0) {
      setLoadingGroups(true)
      fetch('/api/groups')
        .then((r) => r.json())
        .then((data: WhatsAppGroup[]) => setGroups(data))
        .catch(() => toast.error('No se pudieron cargar los grupos'))
        .finally(() => setLoadingGroups(false))
    }
  }, [targetType, groups.length])

  function reset() {
    setTargetType('contact')
    setTargetId('')
    setTargetName('')
    setMessage('')
    setScheduledAt('')
    setOpen(false)
  }

  function handleGroupSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const group = groups.find((g) => g.jid === e.target.value)
    if (group) {
      setTargetId(group.jid)
      setTargetName(group.name)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || !scheduledAt) return
    if (targetType !== 'broadcast' && !targetId.trim()) return

    setLoading(true)
    try {
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetType === 'broadcast' ? 'all' : targetId.trim(),
          target_name: targetName || null,
          message: message.trim(),
          scheduled_at: new Date(scheduledAt).toISOString(),
        }),
      })

      if (!res.ok) throw new Error()

      toast.success('Mensaje programado correctamente')
      reset()
      router.refresh()
    } catch {
      toast.error('No se pudo programar el mensaje')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="h-3.5 w-3.5" />
        Programar mensaje
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Nuevo mensaje programado</CardTitle>
            <CardDescription className="text-xs mt-0.5">Se enviará automáticamente en la fecha indicada</CardDescription>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={reset}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Destinatario</Label>
            <div className="flex gap-2">
              {(['contact', 'group', 'broadcast'] as TargetType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setTargetType(type); setTargetId(''); setTargetName('') }}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    targetType === type
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  {type === 'contact' ? 'Individual' : type === 'group' ? 'Grupo' : 'Broadcast'}
                </button>
              ))}
            </div>
          </div>

          {targetType === 'contact' && (
            <div className="space-y-1.5">
              <Label htmlFor="target_id">Número de teléfono</Label>
              <Input
                id="target_id"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="521234567890 (sin + ni espacios)"
                required
              />
              <p className="text-xs text-muted-foreground">Formato: código de país + número</p>
            </div>
          )}

          {targetType === 'group' && (
            <div className="space-y-1.5">
              <Label htmlFor="group_select">Grupo de WhatsApp</Label>
              {loadingGroups ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando grupos…
                </div>
              ) : groups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No se encontraron grupos. Asegúrate de que tu número sea administrador de al menos un grupo.
                </p>
              ) : (
                <select
                  id="group_select"
                  value={targetId}
                  onChange={handleGroupSelect}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Selecciona un grupo…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.jid}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="message">Mensaje</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe el mensaje que se enviará…"
              rows={3}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scheduled_at">Fecha y hora de envío</Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Programando…' : 'Programar envío'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
