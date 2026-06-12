export interface EscalationCheck {
  shouldEscalate: boolean
  reason: string | null
}

export function checkEscalation(
  latestMessage: string,
  aiResponse: string,
  settings: Record<string, string>,
  turnCount: number
): EscalationCheck {
  // 1. Keyword check in user message
  const keywords: string[] = JSON.parse(settings.escalation_keywords ?? '[]')
  const msgLower = latestMessage.toLowerCase()
  const triggered = keywords.find((kw) => msgLower.includes(kw.toLowerCase()))
  if (triggered) return { shouldEscalate: true, reason: `keyword: "${triggered}"` }

  // 2. AI response signals it needs to escalate
  const escalationPhrases = [
    'no puedo ayudarte con eso',
    'necesito escalar tu consulta',
    'voy a escalar tu caso',
    'fuera de mi conocimiento',
    'I need to escalate',
  ]
  if (escalationPhrases.some((p) => aiResponse.toLowerCase().includes(p))) {
    return { shouldEscalate: true, reason: 'ai_suggested' }
  }

  // 3. Max turns exceeded
  const maxTurns = parseInt(settings.escalation_after_turns ?? '10', 10)
  if (turnCount >= maxTurns) {
    return { shouldEscalate: true, reason: `max_turns: ${turnCount}` }
  }

  return { shouldEscalate: false, reason: null }
}

export function buildEscalationMessages(reason: string | null): {
  toUser: string
  toOwner: (name: string, phone: string, messages: string) => string
} {
  const reasonMap: Record<string, string> = {
    ai_suggested: 'El asistente detectó que necesitas atención personalizada.',
    outside_hours: 'Estamos fuera del horario de atención automatizada.',
  }

  const text = reason?.startsWith('keyword:')
    ? 'Detectamos que tu consulta requiere atención inmediata.'
    : reason?.startsWith('max_turns:')
    ? 'Tu consulta requiere una atención más detallada.'
    : reasonMap[reason ?? ''] ?? 'Tu consulta requiere atención personalizada.'

  return {
    toUser: `${text} Un miembro de nuestro equipo se pondrá en contacto contigo muy pronto. 🙏`,
    toOwner: (name, phone, msgs) =>
      `⚠️ *Escalado al humano*\n\n👤 ${name || 'Sin nombre'}\n📞 ${phone}\n📋 Motivo: ${reason}\n\n*Últimos mensajes:*\n${msgs}`,
  }
}
