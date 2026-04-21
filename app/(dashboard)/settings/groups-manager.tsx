'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { WhatsAppGroup } from '@/lib/ycloud/groups'

interface GroupsManagerProps {
  initial: WhatsAppGroup[]
}

export function GroupsManager({ initial }: GroupsManagerProps) {
  const router = useRouter()
  const [groups, setGroups] = useState(initial)
  const [name, setName] = useState('')
  const [jid, setJid] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !jid.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), jid: jid.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo agregar el grupo')
        return
      }
      setGroups((prev) => [...prev, data as WhatsAppGroup])
      setName('')
      setJid('')
      toast.success('Grupo agregado')
      router.refresh()
    } catch {
      toast.error('Error de red')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch('/api/groups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setGroups((prev) => prev.filter((g) => g.id !== id))
      toast.success('Grupo eliminado')
      router.refresh()
    } catch {
      toast.error('No se pudo eliminar el grupo')
    }
  }

  return (
    <div className="space-y-4">
      {groups.length > 0 && (
        <div className="divide-y rounded-md border">
          {groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="text-sm font-medium">{g.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{g.jid}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDelete(g.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="group_name">Nombre del grupo</Label>
            <Input
              id="group_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Equipo ventas"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group_jid">JID del grupo</Label>
            <Input
              id="group_jid"
              value={jid}
              onChange={(e) => setJid(e.target.value)}
              placeholder="120363XXXXXXXXXX@g.us"
              className="font-mono text-xs"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          El JID lo encuentras en el enlace de invitación del grupo o en los logs del webhook cuando alguien escriba en el grupo.
        </p>
        <Button type="submit" size="sm" variant="outline" disabled={adding || !name.trim() || !jid.trim()}>
          <Plus className="h-3.5 w-3.5" />
          {adding ? 'Agregando…' : 'Agregar grupo'}
        </Button>
      </form>
    </div>
  )
}
