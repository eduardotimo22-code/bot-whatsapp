'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, RefreshCw, Check, X } from 'lucide-react'

interface KBEntry {
  id: string
  question: string
  answer: string
  category: string
  active: boolean
}

interface EntryForm {
  question: string
  answer: string
  category: string
  active: boolean
}

const EMPTY_FORM: EntryForm = { question: '', answer: '', category: '', active: true }

export function KnowledgeManager() {
  const [entries, setEntries] = useState<KBEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<EntryForm>(EMPTY_FORM)
  const [editForm, setEditForm] = useState<EntryForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/knowledge')
    if (res.ok) setEntries(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function forceSync() {
    setSyncing(true)
    await fetch('/api/knowledge', { method: 'PUT' })
    await load()
    setSyncing(false)
  }

  async function handleAdd() {
    if (!form.question.trim() || !form.answer.trim()) return
    setSaving(true)
    const res = await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const entry = await res.json()
      setEntries((prev) => [...prev, entry])
      setForm(EMPTY_FORM)
      setShowAdd(false)
    }
    setSaving(false)
  }

  function startEdit(entry: KBEntry) {
    setEditingId(entry.id)
    setEditForm({ question: entry.question, answer: entry.answer, category: entry.category, active: entry.active })
  }

  async function handleUpdate() {
    if (!editingId) return
    setSaving(true)
    const res = await fetch(`/api/knowledge/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      setEntries((prev) => prev.map((e) => e.id === editingId ? { ...e, ...editForm } : e))
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta entrada?')) return
    const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
    if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  if (loading) return <p className="text-muted-foreground text-sm">Cargando...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{entries.length} entradas</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={forceSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar con Notion
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nueva entrada
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">Nueva entrada</p>
          <Input
            placeholder="Pregunta"
            value={form.question}
            onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
          />
          <Textarea
            placeholder="Respuesta"
            rows={3}
            value={form.answer}
            onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
          />
          <Input
            placeholder="Categoría (opcional)"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}>
              <X className="h-4 w-4 mr-1" />Cancelar
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={saving || !form.question.trim() || !form.answer.trim()}>
              <Check className="h-4 w-4 mr-1" />Guardar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            No hay entradas. Agrega una o sincroniza desde Notion.
          </p>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="border rounded-lg p-4">
            {editingId === entry.id ? (
              <div className="space-y-3">
                <Input
                  value={editForm.question}
                  onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))}
                />
                <Textarea
                  rows={3}
                  value={editForm.answer}
                  onChange={(e) => setEditForm((f) => ({ ...f, answer: e.target.value }))}
                />
                <Input
                  placeholder="Categoría"
                  value={editForm.category}
                  onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.active}
                    onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
                  />
                  Activo
                </label>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4 mr-1" />Cancelar
                  </Button>
                  <Button size="sm" onClick={handleUpdate} disabled={saving}>
                    <Check className="h-4 w-4 mr-1" />Guardar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{entry.question}</p>
                    {!entry.active && <Badge variant="secondary">Inactivo</Badge>}
                    {entry.category && <Badge variant="outline" className="text-xs">{entry.category}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{entry.answer}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(entry)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(entry.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
