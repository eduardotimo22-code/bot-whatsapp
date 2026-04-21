'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { toast } from 'sonner'

export function CancelJobButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    if (!confirm('¿Cancelar este mensaje programado?')) return
    setLoading(true)
    try {
      const res = await fetch('/api/scheduler', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Mensaje cancelado')
      router.refresh()
    } catch {
      toast.error('No se pudo cancelar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={handleCancel}
      disabled={loading}
      title="Cancelar envío"
    >
      <X className="h-3 w-3 text-destructive" />
    </Button>
  )
}
