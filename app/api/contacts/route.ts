import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'

export async function GET() {
  const db = getDb()
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all()
  return NextResponse.json(contacts)
}

export async function POST(request: NextRequest) {
  const db = getDb()
  const body = await request.json() as { phone: string; name?: string; email?: string; interest?: string }

  const id = nanoid()
  db.prepare(`
    INSERT OR IGNORE INTO contacts (id, phone, name, email, interest, source)
    VALUES (?, ?, ?, ?, ?, 'manual')
  `).run(id, body.phone, body.name ?? null, body.email ?? null, body.interest ?? null)

  return NextResponse.json({ id })
}
