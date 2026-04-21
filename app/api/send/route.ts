import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sendTextMessage } from '@/lib/ycloud/sender'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  const db = getDb()
  const { conversation_id, message } = await request.json() as {
    conversation_id: string
    message: string
  }

  if (!conversation_id || !message?.trim()) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const conv = db.prepare('SELECT phone FROM conversations WHERE id = ?').get(conversation_id) as
    | { phone: string }
    | undefined

  if (!conv) {
    return NextResponse.json({ error: 'conversation not found' }, { status: 404 })
  }

  let ycloudMessageId: string | null = null
  try {
    ycloudMessageId = await sendTextMessage(conv.phone, message)
  } catch (err) {
    console.error('[send] YCloud error:', err)
    // Still save the message locally even if send fails
  }

  db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, ycloud_message_id)
    VALUES (?, ?, 'human', ?, ?)
  `).run(nanoid(), conversation_id, message, ycloudMessageId)

  db.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversation_id)

  return NextResponse.json({ ok: true, ycloud_id: ycloudMessageId })
}
