import { getDb } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from 'lucide-react'
import type { ScheduledJob } from '@/types'
import { CreateJobForm } from './create-job-form'
import { CancelJobButton } from './cancel-job-button'
import { RunSchedulerButton } from './run-scheduler-button'

const statusVariant = {
  pending: 'default' as const,
  sent: 'secondary' as const,
  failed: 'destructive' as const,
}

const statusLabel = { pending: 'Pendiente', sent: 'Enviado', failed: 'Fallido' }

const targetTypeLabel: Record<string, string> = {
  contact: 'Contacto',
  group: 'Grupo',
  broadcast: 'Broadcast',
}

export default function SchedulerPage() {
  const db = getDb()
  const jobs = db.prepare('SELECT * FROM scheduled_jobs ORDER BY scheduled_at DESC').all() as ScheduledJob[]
  const pending = jobs.filter((j) => j.status === 'pending').length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mensajes Programados</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pending} en cola · {jobs.length} en total
          </p>
        </div>
        {pending > 0 && <RunSchedulerButton />}
      </div>

      <CreateJobForm />

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p>No hay mensajes programados.</p>
            <p className="text-xs mt-1">Usa el botón de arriba para programar un envío.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cola de envíos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {jobs.map((job) => (
                <div key={job.id} className="py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm line-clamp-2">{job.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Para:{' '}
                        {job.target_type === 'broadcast'
                          ? 'Todos los contactos'
                          : job.target_name ?? job.target_id}
                        {' · '}
                        {targetTypeLabel[job.target_type] ?? job.target_type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.scheduled_at).toLocaleString('es', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                      <Badge variant={statusVariant[job.status]} className="text-xs">
                        {statusLabel[job.status]}
                      </Badge>
                      {job.status === 'pending' && <CancelJobButton id={job.id} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
