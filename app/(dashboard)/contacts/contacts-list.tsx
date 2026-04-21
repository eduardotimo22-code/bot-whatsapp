'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Users, MessageSquare, Search } from 'lucide-react'
import type { Contact } from '@/types'
import Link from 'next/link'

type ContactWithConv = Contact & {
  conv_status: 'active' | 'escalated' | 'resolved' | null
  conv_id: string | null
}

const convStatusVariant = {
  active:   'default'     as const,
  escalated:'destructive' as const,
  resolved: 'secondary'   as const,
}

const convStatusLabel = {
  active:   'Activa',
  escalated:'Escalada',
  resolved: 'Resuelta',
}

export function ContactsList({ contacts }: { contacts: ContactWithConv[] }) {
  const [search, setSearch] = useState('')

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

  const withNotion = contacts.filter((c) => c.notion_page_id).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contactos & Leads</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {contacts.length} contactos
          {withNotion > 0 && ` · ${withNotion} en Notion`}
        </p>
      </div>

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p>No hay contactos aún.</p>
            <p className="text-xs mt-1">El bot detecta y registra leads automáticamente durante las conversaciones.</p>
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
                    <div key={contact.id} className="py-3 flex items-start justify-between gap-4">
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
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {contact.conv_status && (
                          <Badge variant={convStatusVariant[contact.conv_status]} className="text-xs">
                            {convStatusLabel[contact.conv_status]}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">{contact.source}</Badge>
                        {contact.notion_page_id && (
                          <Badge variant="secondary" className="text-xs">Notion</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(contact.created_at).toLocaleDateString('es')}
                        </span>
                        {contact.conv_id && (
                          <Link href={`/conversations/${contact.conv_id}`}>
                            <Button variant="ghost" size="icon-xs" title="Ver conversación">
                              <MessageSquare className="h-3 w-3" />
                            </Button>
                          </Link>
                        )}
                      </div>
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
