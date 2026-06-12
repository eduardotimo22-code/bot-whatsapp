import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params
  const db = getDb()
  const body = await request.json() as { name?: string; email?: string; interest?: string }

  db.prepare(
    'UPDATE contacts SET name = ?, email = ?, interest = ? WHERE id = ?'
  ).run(body.name ?? null, body.email ?? null, body.interest ?? null, id)

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM contacts WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
