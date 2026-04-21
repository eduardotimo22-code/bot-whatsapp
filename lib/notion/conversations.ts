import { getNotionClient } from './client'
import { getDb } from '@/lib/db'
import type { Message } from '@/types'

export interface ConversationLogData {
  contactName: string
  phone: string
  summary: string
  turnCount: number
  status: string
  conversationId: string
}

/**
 * Logs a completed/escalated conversation to the Notion conversations database.
 */
export async function logConversationToNotion(data: ConversationLogData): Promise<void> {
  const db = getDb()
  const dbId = (db.prepare("SELECT value FROM settings WHERE key = 'notion_conversations_db_id'").get() as { value: string } | undefined)?.value

  if (!dbId) return

  try {
    const notion = getNotionClient()

    await notion.pages.create({
      parent: { database_id: dbId },
      properties: {
        Contacto: { title: [{ text: { content: data.contactName || data.phone } }] },
        Teléfono: { rich_text: [{ text: { content: data.phone } }] },
        Resumen: { rich_text: [{ text: { content: data.summary.slice(0, 2000) } }] },
        Turnos: { number: data.turnCount },
        Estado: { select: { name: data.status } },
        Fecha: { date: { start: new Date().toISOString() } },
      },
    })
  } catch (err) {
    console.error('[notion/conversations] Error logging:', err)
  }
}

/**
 * Builds a short summary of the conversation from recent messages.
 */
export function buildConversationSummary(messages: Pick<Message, 'role' | 'content'>[]): string {
  return messages
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`)
    .join('\n')
}
