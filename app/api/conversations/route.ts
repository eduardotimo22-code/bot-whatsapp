import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const conversations = db.prepare(`
    SELECT c.*,
      (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
    FROM conversations c
    ORDER BY c.last_message_at DESC NULLS LAST
  `).all()
  return NextResponse.json(conversations)
}

export async function PATCH(request: NextRequest) {
  const db = getDb()
  const { id, status } = await request.json() as { id: string; status: string }

  if (!['active', 'escalated', 'resolved'].includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  }

  if (status === 'active') {
    db.prepare('UPDATE conversations SET status = ?, turns_reset_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id)
  } else {
    db.prepare('UPDATE conversations SET status = ? WHERE id = ?').run(status, id)
  }
  return NextResponse.json({ ok: true })
}
