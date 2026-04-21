'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'
import { toast } from 'sonner'

export function RunSchedulerButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRun() {
    setLoading(true)
    try {
      const res = await fetch('/api/scheduler/run', { method: 'POST' })
      if (!res.ok) throw new Error()
      const { sent, failed } = await res.json() as { sent: number; failed: number }

      if (sent === 0 && failed === 0) {
        toast.info('No hay mensajes pendientes por enviar ahora')
      } else {
        toast.success(`${sent} enviado${sent !== 1 ? 's' : ''}${failed > 0 ? ` · ${failed} fallido${failed !== 1 ? 's' : ''}` : ''}`)
      }

      router.refresh()
    } catch {
      toast.error('Error al ejecutar el scheduler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRun} disabled={loading}>
      <Play className="h-3.5 w-3.5" />
      {loading ? 'Ejecutando…' : 'Ejecutar ahora'}
    </Button>
  )
}
