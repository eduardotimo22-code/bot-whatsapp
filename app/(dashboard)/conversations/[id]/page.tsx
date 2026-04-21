import { getDb } from '@/lib/db'
import { notFound } from 'next/navigation'
import { ConversationView } from './conversation-view'
import type { Conversation, Message } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ConversationDetailPage({ params }: PageProps) {
  const { id } = await params
  const db = getDb()

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation | undefined
  if (!conv) notFound()

  const messages = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).all(id) as Message[]

  return <ConversationView conversation={conv} initialMessages={messages} />
}
