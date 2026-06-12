import { getDb } from '@/lib/db'
import type { BotSettings } from '@/types'

export interface EscalationCheck {
  shouldEscalate: boolean
  reason: string | null
}

/**
 * Checks if a conversation should be escalated to a human agent.
 */
export function checkEscalation(
  conversationId: string,
  latestMessage: string,
  aiResponse: string
): EscalationCheck {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value])) as unknown as BotSettings

  // 1. Keyword check in user message — skip if bot was collecting address/delivery info
  const keywords: string[] = JSON.parse(settings.escalation_keywords || '[]')
  const msgLower = latestMessage.toLowerCase()

  const lastBotMsg = db.prepare(
    `SELECT content FROM messages WHERE conversation_id = ? AND role = 'assistant'
     ORDER BY created_at DESC LIMIT 1`
  ).get(conversationId) as { content: string } | undefined

  const addressPhrases = ['dirección', 'domicilio', 'nombre completo', 'calle', 'colonia', 'referencias']
  const botWasCollectingAddress = !!lastBotMsg &&
    addressPhrases.some((p) => lastBotMsg.content.toLowerCase().includes(p))

  if (!botWasCollectingAddress) {
    const triggeredKeyword = keywords.find((kw) => msgLower.includes(kw.toLowerCase()))
    if (triggeredKeyword) {
      return { shouldEscalate: true, reason: `keyword: "${triggeredKeyword}"` }
    }
  }

  // 2. AI explicitly says it doesn't know / needs human
  const escalationPhrases = [
    'no puedo ayudarte con eso',
    'necesito escalar tu consulta',
    'voy a escalar tu caso',
    'fuera de mi conocimiento',
    'I need to escalate',
  ]
  const aiLower = aiResponse.toLowerCase()
  if (escalationPhrases.some((p) => aiLower.includes(p))) {
    return { shouldEscalate: true, reason: 'ai_suggested' }
  }

  // 3. Max turns check — only count messages from the last 2 hours to avoid
  //    accumulated test messages triggering escalation after a reactivation
  const maxTurns = parseInt(settings.escalation_after_turns || '8', 10)
  const conv = db.prepare('SELECT turns_reset_at FROM conversations WHERE id = ?').get(conversationId) as { turns_reset_at: string | null } | undefined
  const resetAt = conv?.turns_reset_at ?? null
  const turnCount = (db.prepare(
    `SELECT COUNT(*) as c FROM messages WHERE conversation_id = ? AND role = 'user' AND created_at >= COALESCE(?, datetime('now', '-2 hours'))`
  ).get(conversationId, resetAt) as { c: number }).c

  if (turnCount >= maxTurns) {
    return { shouldEscalate: true, reason: `max_turns: ${turnCount}` }
  }

  // 4. Outside business hours
  if (!isWithinBusinessHours(settings)) {
    return { shouldEscalate: true, reason: 'outside_hours' }
  }

  return { shouldEscalate: false, reason: null }
}

function isWithinBusinessHours(settings: BotSettings): boolean {
  const now = new Date()
  const days: string[] = JSON.parse(settings.business_days || '[]')
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const currentDay = dayNames[now.getDay()]

  if (!days.includes(currentDay)) return false

  const [startH, startM] = settings.business_hours_start.split(':').map(Number)
  const [endH, endM] = settings.business_hours_end.split(':').map(Number)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes
}

export function buildEscalationMessages(reason: string | null): {
  toUser: string
  toOwner: (contactName: string, phone: string, lastMessages: string) => string
} {
  const reasonMap: Record<string, string> = {
    ai_suggested: 'El asistente detectó que necesitas atención personalizada.',
    outside_hours: 'Estamos fuera del horario de atención automatizada.',
  }

  const reasonText = reason?.startsWith('keyword:')
    ? 'Detectamos que tu consulta requiere atención inmediata.'
    : reason?.startsWith('max_turns:')
    ? 'Tu consulta requiere una atención más detallada.'
    : reasonMap[reason ?? ''] ?? 'Tu consulta requiere atención personalizada.'

  return {
    toUser: `${reasonText} Un miembro de nuestro equipo se pondrá en contacto contigo muy pronto. 🙏`,
    toOwner: (contactName, phone, lastMessages) =>
      `⚠️ *Escalado al humano*\n\n👤 ${contactName || 'Sin nombre'}\n📞 ${phone}\n📋 Motivo: ${reason}\n\n*Últimos mensajes:*\n${lastMessages}`,
  }
}
