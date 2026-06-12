'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Users, MessageSquare, Search, Pencil, Trash2, Check, X } from 'lucide-react'
import type { Contact } from '@/types'
import Link from 'next/link'
import { toast } from 'sonner'

type ContactWithConv = Contact & {
  conv_status: 'active' | 'escalated' | 'resolved' | null
  conv_id: string | null
}

interface EditForm {
  name: string
  email: string
  interest: string
}

const convStatusVariant = {
  active:    'default'     as const,
  escalated: 'destructive' as const,
  resolved:  'secondary'   as const,
}

const convStatusLabel = {
  active:    'Activa',
  escalated: 'Escalada',
  resolved:  'Resuelta',
}

export function ContactsList({ contacts: initial }: { contacts: ContactWithConv[] }) {
  const [contacts, setContacts] = useState(initial)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ name: '', email: '', interest: '' })
  const [saving, setSaving] = useState(false)

  const q = search.trim().toLowerCase()
  const visible = q
    ? contacts.filter(
        (c) =>
          (c.name ?? '').toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.interest ?? '').toLowerCase().includes(q)
      )
    : contacts

  function startEdit(contact: ContactWithConv) {
    setEditingId(contact.id)
    setEditForm({
      name: contact.name ?? '',
      email: contact.email ?? '',
      interest: contact.interest ?? '',
    })
  }

  async function saveEdit(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) throw new Error()
      setContacts((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, name: editForm.name || null, email: editForm.email || null, interest: editForm.interest || null }
            : c
        )
      )
      setEditingId(null)
      toast.success('Contacto actualizado')
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function deleteContact(id: string) {
    if (!confirm('¿Eliminar este contacto? Esta acción no se puede deshacer.')) return
    const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setContacts((prev) => prev.filter((c) => c.id !== id))
      toast.success('Contacto eliminado')
    } else {
      toast.error('No se pudo eliminar')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contactos & Leads</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {contacts.length} contactos registrados
        </p>
      </div>

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p>No hay contactos aún.</p>
            <p className="text-xs mt-1">El bot registra contactos automáticamente durante las conversaciones.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono, email o interés…"
              className="pl-8 h-8 text-sm"
            />
          </div>

          {visible.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
                <p className="text-sm">Sin resultados para &ldquo;{search}&rdquo;</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {q ? `${visible.length} de ${contacts.length} contactos` : 'Todos los contactos'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {visible.map((contact) => (
                    <div key={contact.id} className="py-4">
                      {editingId === contact.id ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground font-medium w-20">Teléfono</span>
                            <span className="text-sm">{contact.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground font-medium w-20">Nombre</label>
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                              className="h-7 text-sm"
                              placeholder="Nombre"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground font-medium w-20">Email</label>
                            <Input
                              value={editForm.email}
                              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                              className="h-7 text-sm"
                              placeholder="email@ejemplo.com"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground font-medium w-20">Interés</label>
                            <Input
                              value={editForm.interest}
                              onChange={(e) => setEditForm((f) => ({ ...f, interest: e.target.value }))}
                              className="h-7 text-sm"
                              placeholder="¿En qué está interesado?"
                            />
                          </div>
                          <div className="flex gap-2 justify-end mt-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                              <X className="h-3.5 w-3.5 mr-1" />Cancelar
                            </Button>
                            <Button size="sm" onClick={() => saveEdit(contact.id)} disabled={saving}>
                              <Check className="h-3.5 w-3.5 mr-1" />Guardar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{contact.name || 'Sin nombre'}</span>
                              <span className="text-xs text-muted-foreground">{contact.phone}</span>
                            </div>
                            {contact.email && (
                              <p className="text-xs text-muted-foreground mt-0.5">{contact.email}</p>
                            )}
                            {contact.interest && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                Interés: {contact.interest}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {contact.conv_status && (
                                <Badge variant={convStatusVariant[contact.conv_status]} className="text-xs">
                                  {convStatusLabel[contact.conv_status]}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs capitalize">{contact.source}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(contact.created_at).toLocaleDateString('es')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {contact.conv_id && (
                              <Link href={`/conversations/${contact.conv_id}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver conversación">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(contact)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteContact(contact.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
