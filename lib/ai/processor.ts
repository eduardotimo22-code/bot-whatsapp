import OpenAI from 'openai'
import { getDb } from '@/lib/db'
import { buildContext } from './context-builder'
import { checkEscalation, buildEscalationMessages } from './escalation'
import { sendTextMessage } from '@/lib/ycloud/sender'
import { getMenuText } from '@/lib/sheets/menu'
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

const MENU_TRIGGERS = [
  'menú', 'menu', 'carta', 'que tienen', 'qué tienen', 'que pizzas', 'qué pizzas',
  'que hay', 'qué hay', 'que venden', 'qué venden', 'ver el menu', 'ver el menú',
  'envíame el menu', 'mándame el menu', 'quiero ver', 'opciones', 'what do you have',
  'what\'s the menu', 'show menu',
]

function isMenuRequest(message: string): boolean {
  const lower = message.toLowerCase()
  return MENU_TRIGGERS.some((trigger) => lower.includes(trigger))
}

export async function processMessage(conversationId: string): Promise<void> {
  const db = getDb()

  const latest = db.prepare(`
    SELECT content FROM messages
    WHERE conversation_id = ? AND role = 'user'
    ORDER BY created_at DESC LIMIT 1
  `).get(conversationId) as { content: string } | undefined

  if (!latest) return

  const latestMessage = latest.content

  const settingsRows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value])) as unknown as BotSettings

  // Shortcut: if the client is asking for the menu, send it directly without GPT
  if (isMenuRequest(latestMessage)) {
    const conv = db.prepare('SELECT phone FROM conversations WHERE id = ?').get(conversationId) as { phone: string } | undefined
    if (conv) {
      try {
        const menuText = await getMenuText()
        await sendTextMessage(conv.phone, menuText)
        db.prepare(`
          INSERT INTO messages (id, conversation_id, role, content)
          VALUES (?, ?, 'assistant', ?)
        `).run(nanoid(), conversationId, menuText)
        db.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId)
        console.log(`[processor] Sent menu to ${conv.phone}`)
      } catch (err) {
        console.error('[processor] Menu send error:', err)
      }
    }
    return
  }

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
      max_tokens: 600,
      temperature: 0.4,
    })
    aiResponse = completion.choices[0]?.message?.content ?? 'Lo siento, no pude procesar tu mensaje.'
  } catch (err) {
    console.error('[processor] OpenAI error:', err)
    aiResponse = 'En este momento tenemos dificultades técnicas. Por favor, inténtalo de nuevo en unos minutos.'
  }

  // Extract order confirmation tag before sending to client
  const orderMatch = aiResponse.match(/\[PEDIDO_CONFIRMADO:[^\]]+\]/)
  const cleanResponse = aiResponse.replace(/\[PEDIDO_CONFIRMADO:[^\]]+\]\s*/g, '').trim()

  console.log(`[processor] AI response (${conversationId}): "${cleanResponse.slice(0, 120)}" | order: ${!!orderMatch}`)

  // Skip escalation check when an order was just confirmed
  if (!orderMatch) {
    const escalation = checkEscalation(conversationId, latestMessage, cleanResponse)
    if (escalation.shouldEscalate) {
      await handleEscalation(conversationId, escalation.reason, settings)
      return
    }
  }

  // Save AI response to SQLite
  db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content)
    VALUES (?, ?, 'assistant', ?)
  `).run(nanoid(), conversationId, cleanResponse)

  const conv = db.prepare('SELECT phone, contact_name FROM conversations WHERE id = ?').get(conversationId) as
    | { phone: string; contact_name: string | null }
    | undefined

  if (conv) {
    try {
      await sendTextMessage(conv.phone, cleanResponse)
    } catch (err) {
      console.error('[processor] Send error:', err)
    }

    // Save confirmed order to DB and notify owner
    if (orderMatch) {
      await handleOrderConfirmation(orderMatch[0], conversationId, conv.contact_name ?? conv.phone, conv.phone, settings)
    }
  }

  db.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId)
}

async function handleOrderConfirmation(
  tag: string,
  conversationId: string,
  contactName: string,
  contactPhone: string,
  settings: BotSettings
): Promise<void> {
  const db = getDb()

  const getField = (key: string) => tag.match(new RegExp(`${key}=([^,\\]]+)`))?.[1]?.trim() ?? ''
  const nombre = getField('nombre')
  const items = tag.match(/items=([\s\S]+?),\s*total=/)?.[1]?.trim() ?? getField('items')
  const total = getField('total')
  const tipo = getField('tipo')
  const pago = getField('pago')

  // Save order to SQLite
  try {
    db.prepare(`
      INSERT INTO orders (id, conversation_id, items, total, source, status, delivery_type)
      VALUES (?, ?, ?, ?, 'whatsapp', 'confirmed', ?)
    `).run(nanoid(), conversationId, items, parseFloat(total) || null, tipo || null)
  } catch (err) {
    console.error('[processor] Order DB insert error:', err)
  }

  // Notify owner
  if (settings.owner_phone) {
    const msg = [
      `🍕 *Nuevo pedido confirmado*`,
      `👤 Cliente: ${nombre || contactName} (${contactPhone})`,
      `📋 Items: ${items}`,
      total && `💰 Total: $${total}`,
      tipo && `🚗 Tipo: ${tipo}`,
      pago && `💳 Pago: ${pago}`,
    ].filter(Boolean).join('\n')

    try {
      await sendTextMessage(settings.owner_phone, msg)
    } catch (err) {
      console.error('[processor] Order notify error:', err)
    }
  }
}

async function handleEscalation(conversationId: string, reason: string | null, settings: BotSettings): Promise<void> {
  const db = getDb()

  db.prepare("UPDATE conversations SET status = 'escalated' WHERE id = ?").run(conversationId)

  const conv = db.prepare('SELECT phone, contact_name FROM conversations WHERE id = ?').get(conversationId) as
    | { phone: string; contact_name: string | null }
    | undefined

  if (!conv) return

  const msgs = buildEscalationMessages(reason)

  try {
    await sendTextMessage(conv.phone, msgs.toUser)
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content)
      VALUES (?, ?, 'assistant', ?)
    `).run(nanoid(), conversationId, msgs.toUser)
  } catch (err) {
    console.error('[processor] Escalation user notify error:', err)
  }

  if (settings.owner_phone) {
    const recentMessages = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC LIMIT 6
    `).all(conversationId) as Pick<Message, 'role' | 'content'>[]

    const summary = recentMessages
      .reverse()
      .map((m) => `${m.role === 'user' ? '👤' : '🤖'} ${m.content}`)
      .join('\n')

    const ownerMsg = msgs.toOwner(conv.contact_name ?? 'Sin nombre', conv.phone, summary)

    try {
      await sendTextMessage(settings.owner_phone, ownerMsg)
    } catch (err) {
      console.error('[processor] Owner notify error:', err)
    }
  }
}
