import OpenAI from 'openai'
import { getDb } from '@/lib/db'
import { buildContext } from './context-builder'
import { checkEscalation, buildEscalationMessages } from './escalation'
import { sendTextMessage } from '@/lib/ycloud/sender'
import { logConversationToNotion, buildConversationSummary } from '@/lib/notion/conversations'
import { detectLeadSignals, saveLeadToNotion } from '@/lib/notion/leads'
import { nanoid } from 'nanoid'
import type { Message, BotSettings } from '@/types'

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (openaiClient) return openaiClient
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  openaiClient = new OpenAI({ apiKey })
  return openaiClient
}

/**
 * Main AI processing pipeline for an incoming message.
 * Runs after the message has been saved to SQLite.
 */
export async function processMessage(conversationId: string): Promise<void> {
  const db = getDb()

  // Get the latest user message
  const latest = db.prepare(`
    SELECT content FROM messages
    WHERE conversation_id = ? AND role = 'user'
    ORDER BY created_at DESC LIMIT 1
  `).get(conversationId) as { content: string } | undefined

  if (!latest) return

  const latestMessage = latest.content

  // Load settings
  const settingsRows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value])) as unknown as BotSettings

  // Build full context (history + knowledge base + settings)
  const context = await buildContext(conversationId, latestMessage)

  // Call GPT-4o
  let aiResponse: string
  try {
    const openai = getOpenAI()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: context.systemPrompt },
        ...context.history,
        { role: 'user', content: context.latestMessage },
      ],
      max_tokens: 500,
      temperature: 0.4,
    })
    aiResponse = completion.choices[0]?.message?.content ?? 'Lo siento, no pude procesar tu mensaje.'
  } catch (err) {
    console.error('[processor] OpenAI error:', err)
    aiResponse = 'En este momento tenemos dificultades técnicas. Por favor, inténtalo de nuevo en unos minutos.'
  }

  // Extract and strip appointment confirmation tag before sending to client
  const appointmentMatch = aiResponse.match(/\[CITA_CONFIRMADA:[^\]]+\]/)
  const cleanResponse = aiResponse.replace(/\[CITA_CONFIRMADA:[^\]]+\]\s*/g, '').trim()

  console.log(`[processor] AI response (${conversationId}): "${cleanResponse.slice(0, 120)}" | tag: ${!!appointmentMatch}`)

  // If the AI confirmed an appointment, skip escalation — it handled the conversation successfully
  if (!appointmentMatch) {
    const escalation = checkEscalation(conversationId, latestMessage, cleanResponse)
    console.log(`[processor] Escalation check: ${JSON.stringify(escalation)}`)
    if (escalation.shouldEscalate) {
      await handleEscalation(conversationId, escalation.reason)
      return
    }
  }

  // Save AI response to SQLite (clean, without the tag)
  db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content)
    VALUES (?, ?, 'assistant', ?)
  `).run(nanoid(), conversationId, cleanResponse)

  // Get conversation phone to send the reply
  const conv = db.prepare('SELECT phone, contact_name FROM conversations WHERE id = ?').get(conversationId) as
    | { phone: string; contact_name: string | null }
    | undefined

  if (conv) {
    try {
      await sendTextMessage(conv.phone, cleanResponse)
    } catch (err) {
      console.error('[processor] Send error:', err)
    }

    // Send appointment notification if confirmed
    if (appointmentMatch) {
      await notifyAppointment(appointmentMatch[0], conv.contact_name ?? conv.phone, conv.phone, settings)
    }

    // Detect and save leads
    const leadSignals = detectLeadSignals(latestMessage)
    if (leadSignals) {
      const contact = db.prepare('SELECT id, notion_page_id FROM contacts WHERE phone = ?').get(conv.phone) as
        | { id: string; notion_page_id: string | null }
        | undefined

      if (contact) {
        // Update email if detected
        if (leadSignals.email) {
          db.prepare('UPDATE contacts SET email = ? WHERE id = ? AND email IS NULL').run(leadSignals.email, contact.id)
          db.prepare('UPDATE contacts SET interest = ? WHERE id = ? AND interest IS NULL').run(leadSignals.interest, contact.id)
        }

        await saveLeadToNotion({
          phone: conv.phone,
          name: conv.contact_name,
          email: leadSignals.email,
          interest: leadSignals.interest,
          contactId: contact.id,
        })
      }
    }
  }

  // Update conversation timestamp
  db.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId)
}

async function handleEscalation(conversationId: string, reason: string | null): Promise<void> {
  const db = getDb()

  // Mark conversation as escalated
  db.prepare("UPDATE conversations SET status = 'escalated' WHERE id = ?").run(conversationId)

  const conv = db.prepare('SELECT phone, contact_name FROM conversations WHERE id = ?').get(conversationId) as
    | { phone: string; contact_name: string | null }
    | undefined

  if (!conv) return

  const msgs = buildEscalationMessages(reason)

  // Notify the user
  try {
    await sendTextMessage(conv.phone, msgs.toUser)
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content)
      VALUES (?, ?, 'assistant', ?)
    `).run(nanoid(), conversationId, msgs.toUser)
  } catch (err) {
    console.error('[processor] Escalation user notify error:', err)
  }

  // Notify the owner
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value])) as unknown as BotSettings

  if (settings.owner_phone) {
    const recentMessages = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC LIMIT 6
    `).all(conversationId) as Pick<Message, 'role' | 'content'>[]

    const summary = buildConversationSummary(recentMessages.reverse())
    const ownerMsg = msgs.toOwner(conv.contact_name ?? 'Sin nombre', conv.phone, summary)

    try {
      await sendTextMessage(settings.owner_phone, ownerMsg)
    } catch (err) {
      console.error('[processor] Owner notify error:', err)
    }
  }

  // Log to Notion
  const allMessages = db.prepare(`
    SELECT role, content, created_at FROM messages WHERE conversation_id = ?
    ORDER BY created_at ASC
  `).all(conversationId) as Message[]

  await logConversationToNotion({
    contactName: conv.contact_name ?? '',
    phone: conv.phone,
    summary: buildConversationSummary(allMessages),
    turnCount: allMessages.filter((m) => m.role === 'user').length,
    status: 'escalated',
    conversationId,
  })
}

async function notifyAppointment(
  tag: string,
  contactName: string,
  contactPhone: string,
  settings: BotSettings
): Promise<void> {
  const notifyPhone = settings.appointment_notification_phone
  if (!notifyPhone) return

  // Parse tag: [CITA_CONFIRMADA: nombre=X, fecha=Y, hora=Z, servicio=W]
  const get = (key: string) => tag.match(new RegExp(`${key}=([^,\\]]+)`))?.[1]?.trim() ?? ''

  const nombre = get('nombre') || contactName
  const fecha = get('fecha')
  const hora = get('hora')
  const servicio = get('servicio')

  const msg = [
    `📅 *Nueva cita confirmada*`,
    `👤 Cliente: ${nombre} (${contactPhone})`,
    fecha && `📆 Fecha: ${fecha}`,
    hora && `🕐 Hora: ${hora}`,
    servicio && `💼 Motivo: ${servicio}`,
  ].filter(Boolean).join('\n')

  try {
    await sendTextMessage(notifyPhone, msg)
  } catch (err) {
    console.error('[processor] Appointment notify error:', err)
  }
}
