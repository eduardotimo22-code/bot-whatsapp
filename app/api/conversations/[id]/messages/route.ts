import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import type { Conversation, Message } from '@/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const db = getDb()

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation | undefined
  if (!conversation) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const messages = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).all(id) as Message[]

  return NextResponse.json({ conversation, messages })
}
