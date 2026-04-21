import { getDb } from '@/lib/db'
import type { Conversation } from '@/types'
import { ConversationsList } from './conversations-list'

export default function ConversationsPage() {
  const db = getDb()
  const conversations = db.prepare(`
    SELECT c.*,
      (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
    FROM conversations c
    ORDER BY c.last_message_at DESC NULLS LAST
  `).all() as (Conversation & { last_message: string })[]

  return <ConversationsList initial={conversations} />
}
