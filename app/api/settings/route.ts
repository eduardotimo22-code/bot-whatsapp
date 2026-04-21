import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return NextResponse.json(settings)
}

export async function PUT(request: NextRequest) {
  const db = getDb()
  const body = await request.json() as Record<string, string>

  const update = db.prepare(
    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
  )
  const updateMany = db.transaction((entries: [string, string][]) => {
    for (const [key, value] of entries) {
      update.run(key, value)
    }
  })

  updateMany(Object.entries(body))
  return NextResponse.json({ ok: true })
}
