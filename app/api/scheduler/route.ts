import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'
import type { ScheduledJob } from '@/types'

export async function GET() {
  const db = getDb()
  const jobs = db.prepare('SELECT * FROM scheduled_jobs ORDER BY scheduled_at DESC').all()
  return NextResponse.json(jobs)
}

export async function POST(request: NextRequest) {
  const db = getDb()
  const body = await request.json() as {
    target_type: string
    target_id: string
    target_name?: string
    message: string
    scheduled_at: string
  }

  const id = nanoid()
  db.prepare(`
    INSERT INTO scheduled_jobs (id, target_type, target_id, target_name, message, scheduled_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, body.target_type, body.target_id, body.target_name ?? null, body.message, body.scheduled_at)

  const job = db.prepare('SELECT * FROM scheduled_jobs WHERE id = ?').get(id) as ScheduledJob
  return NextResponse.json({ id: job.id })
}

export async function DELETE(request: NextRequest) {
  const db = getDb()
  const { id } = await request.json() as { id: string }
  db.prepare("DELETE FROM scheduled_jobs WHERE id = ? AND status = 'pending'").run(id)
  return NextResponse.json({ ok: true })
}
