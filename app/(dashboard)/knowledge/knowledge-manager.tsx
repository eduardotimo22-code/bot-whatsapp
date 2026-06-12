'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, ExternalLink } from 'lucide-react'

interface KBEntry {
  id: string
  question: string
  answer: string
  category: string
  active: boolean
}

export function KnowledgeManager({ spreadsheetId }: { spreadsheetId?: string }) {
  const [entries, setEntries] = useState<KBEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/knowledge')
    if (res.ok) {
      const data = await res.json()
      setEntries(data)
      if (data.length > 0) setLastSync(new Date().toLocaleTimeString('es'))
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function forceSync() {
    setSyncing(true)
    await fetch('/api/knowledge', { method: 'PUT' })
    await load()
    setSyncing(false)
  }

  const sheetUrl = spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    : null

  if (loading) return <p className="text-muted-foreground text-sm">Cargando...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{entries.length} entradas sincronizadas</span>
          {lastSync && <span className="text-xs text-muted-foreground">· Última sync: {lastSync}</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={forceSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar desde Sheets
          </Button>
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Google Sheet
            </a>
          )}
        </div>
      </div>

      {entries.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm space-y-2">
          <p>No hay entradas en la base de conocimiento.</p>
          {sheetUrl ? (
            <p>
              Agrega preguntas y respuestas en la pestaña <strong>Conocimiento</strong> de tu{' '}
              <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Google Sheet
              </a>{' '}
              y luego presiona <em>Sincronizar</em>.
            </p>
          ) : (
            <p>Configura el ID del Google Sheet en <strong>Configuración</strong> y luego sincroniza.</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="border rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{entry.question}</p>
                  {!entry.active && <Badge variant="secondary">Inactivo</Badge>}
                  {entry.category && <Badge variant="outline" className="text-xs">{entry.category}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{entry.answer}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {entries.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Para editar estas entradas, abre el Google Sheet y modifícalas directamente. Los cambios se sincronizan automáticamente cada 5 minutos o al presionar &quot;Sincronizar&quot;.
        </p>
      )}
    </div>
  )
}
