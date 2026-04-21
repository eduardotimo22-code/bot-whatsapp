import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import type { DashboardStats } from '@/types'

export async function GET() {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]

  const stats: DashboardStats = {
    active_conversations: (db.prepare("SELECT COUNT(*) as c FROM conversations WHERE status = 'active'").get() as { c: number }).c,
    escalated_conversations: (db.prepare("SELECT COUNT(*) as c FROM conversations WHERE status = 'escalated'").get() as { c: number }).c,
    total_contacts: (db.prepare('SELECT COUNT(*) as c FROM contacts').get() as { c: number }).c,
    pending_jobs: (db.prepare("SELECT COUNT(*) as c FROM scheduled_jobs WHERE status = 'pending'").get() as { c: number }).c,
    messages_today: (db.prepare("SELECT COUNT(*) as c FROM messages WHERE date(created_at) = ?").get(today) as { c: number }).c,
  }

  return NextResponse.json(stats)
}
