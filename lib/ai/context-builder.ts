import { getDb } from '@/lib/db'
import { queryKnowledgeBase } from '@/lib/sheets/knowledge'
import type { BotSettings, Message } from '@/types'

export interface AiContext {
  systemPrompt: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  latestMessage: string
}

export async function buildContext(conversationId: string, latestMessage: string): Promise<AiContext> {
  const db = getDb()

  // Load settings
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value])) as unknown as BotSettings

  // Load conversation history (last 12 messages for context window efficiency)
  const messages = db.prepare(`
    SELECT role, content FROM messages
    WHERE conversation_id = ? AND role IN ('user', 'assistant')
    ORDER BY created_at DESC
    LIMIT 12
  `).all(conversationId) as Pick<Message, 'role' | 'content'>[]

  const history = messages
    .reverse()
    .slice(0, -1) // exclude the latest message we're about to process
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  // Query knowledge base for relevant context
  const knowledgeEntries = await queryKnowledgeBase(latestMessage)
  const knowledgeBlock = knowledgeEntries.length > 0
    ? `\n\nINFORMACIÓN RELEVANTE DE LA BASE DE CONOCIMIENTO:\n${knowledgeEntries
        .map((e) => `[${e.category ? e.category + '] ' : ''}${e.question}\n${e.answer}`)
        .join('\n\n')}`
    : ''

  // Build the system prompt
  const now = new Date()
  const timeStr = now.toLocaleTimeString('es', { timeStyle: 'short' })
  const dayStr = now.toLocaleDateString('es', { weekday: 'long' })

  const systemPrompt = [
    settings.system_prompt,
    `\nNombre del asistente: ${settings.bot_name}`,
    `Tono: ${settings.tone}`,
    `Horario de atención: ${settings.business_hours_start} - ${settings.business_hours_end}`,
    `Hora actual: ${timeStr} (${dayStr})`,
    knowledgeBlock,
    '\nIMPORTANTE — PRECIOS: NUNCA inventes ni estimes precios, ingredientes ni disponibilidad. Usa ÚNICAMENTE los datos del menú y la base de conocimiento. Si no tienes el dato exacto, di: "No tengo ese dato, déjame verificarlo con el equipo."',
    'Si no tienes información suficiente para responder con precisión, indica que vas a escalar la consulta al equipo humano.',
    'Responde siempre en el mismo idioma que el cliente.',
    '\nIMPORTANTE — PEDIDO CONFIRMADO (esta instrucción anula cualquier formato de tag mencionado antes):',
    'Cuando el cliente confirme su pedido, incluye al FINAL de tu respuesta esta línea exacta (invisible para el cliente):',
    '[PEDIDO_CONFIRMADO: nombre=NOMBRE, items=LISTA, total=NUMERO, tipo=entrega|recoger, pago=efectivo|tarjeta|transferencia]',
    'Reglas estrictas — sustituye CADA campo con el valor real, NUNCA dejes llaves {} ni mayúsculas de plantilla:',
    '- nombre: nombre real del cliente tal como lo proporcionó',
    '- items: "1x Pizza Hawaiana Mediana | 1x Refresco". NUNCA uses {} ni comas para separar items.',
    '- total: suma exacta de precios del menú. OBLIGATORIO, nunca vacío ni entre llaves.',
    '- tipo: exactamente "entrega" o "recoger"',
    '- pago: exactamente "efectivo", "tarjeta" o "transferencia"',
  ].join('\n')

  return { systemPrompt, history, latestMessage }
}
