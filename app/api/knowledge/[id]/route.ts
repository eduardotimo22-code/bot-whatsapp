import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// With Google Sheets, edits happen directly in the Sheet.
// These routes only allow toggling active/inactive in the local cache.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json() as { active?: boolean }
    const db = getDb()
    if (body.active !== undefined) {
      db.prepare('UPDATE kb_cache SET active = ? WHERE id = ?').run(body.active ? 1 : 0, id)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getDb()
    db.prepare('DELETE FROM kb_cache WHERE id = ?').run(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
