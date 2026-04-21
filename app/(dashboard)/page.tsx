import { getDb } from '@/lib/db'
import type { DashboardStats } from '@/types'
import { DashboardStatsView } from './dashboard-stats'

function getStats(): DashboardStats {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]

  return {
    active_conversations: (db.prepare("SELECT COUNT(*) as c FROM conversations WHERE status = 'active'").get() as { c: number }).c,
    escalated_conversations: (db.prepare("SELECT COUNT(*) as c FROM conversations WHERE status = 'escalated'").get() as { c: number }).c,
    total_contacts: (db.prepare('SELECT COUNT(*) as c FROM contacts').get() as { c: number }).c,
    pending_jobs: (db.prepare("SELECT COUNT(*) as c FROM scheduled_jobs WHERE status = 'pending'").get() as { c: number }).c,
    messages_today: (db.prepare("SELECT COUNT(*) as c FROM messages WHERE date(created_at) = ?").get(today) as { c: number }).c,
  }
}

export default function DashboardPage() {
  const stats = getStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumen del sistema · se actualiza cada 15 segundos</p>
      </div>
      <DashboardStatsView initial={stats} />
    </div>
  )
}
