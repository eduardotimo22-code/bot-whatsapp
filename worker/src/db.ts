import type { Env } from './index'
import { parseDbDateMs } from './phone'

export interface Conversation {
  id: string
  phone: string
  contact_name: string | null
  status: string
  turns_reset_at: string | null
  last_message_at: string | null
  escalated_at: string | null
  paused_until: string | null
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
}

export interface KBEntry {
  id: string
  question: string
  answer: string
  category: string
}

export interface MenuItem {
  category: string
  product: string
  description: string
  price: number | null
  available: boolean
}

const SETTINGS_DEFAULTS: [string, string][] = [
  ['bot_name', 'Junior'],
  ['tone', 'amigable, rápido y entusiasta con la comida'],
  ['system_prompt', 'Eres Junior, el asistente virtual de Pizza Juniors Cozumel.'],
  ['business_hours_start', '11:00'],
  ['business_hours_end', '23:00'],
  ['business_days', JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])],
  ['escalation_keywords', JSON.stringify(['hablar con alguien', 'queja', 'reembolso'])],
  ['escalation_after_turns', '20'],
  ['owner_phone', ''],
  ['owner_phones', '[]'],
  ['no_escalate_phones', '[]'],
  ['owner_template_name', 'owner_notification'],
  ['owner_template_lang', 'es_MX'],
  // 'true' = notifica a owners por template (de pago, llega fuera de ventana 24h).
  // 'false' = solo texto gratis (solo llega si el owner tiene ventana 24h abierta).
  ['owner_notify_template', 'true'],
  ['bot_paused', 'false'],
]

const MEMORY_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

export async function getSettings(env: Env): Promise<Record<string, string>> {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()

  if (results.length === 0) {
    await seedSettings(env)
    return Object.fromEntries(SETTINGS_DEFAULTS)
  }

  // Merge sobre defaults: settings nuevos agregados al código aparecen aunque
  // la tabla ya esté poblada (seedSettings solo corre con tabla vacía)
  return {
    ...Object.fromEntries(SETTINGS_DEFAULTS),
    ...Object.fromEntries(results.map((r) => [r.key, r.value])),
  }
}

async function seedSettings(env: Env): Promise<void> {
  const stmts = SETTINGS_DEFAULTS.map(([key, value]) =>
    env.DB.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind(key, value)
  )
  await env.DB.batch(stmts)
}

export async function getOrCreateConversation(
  env: Env,
  phone: string,
  name: string | null
): Promise<Conversation> {
  const existing = await env.DB.prepare(
    'SELECT id, phone, contact_name, status, turns_reset_at, last_message_at, escalated_at, paused_until FROM conversations WHERE id = ?'
  ).bind(phone).first<Conversation>()

  if (existing) {
    // Detectar brecha de 24h — si la última actividad fue hace más de 24h, resetear memoria
    const lastMsgAt = existing.last_message_at
    const age = lastMsgAt ? Date.now() - parseDbDateMs(lastMsgAt) : Infinity
    const memoryExpired = age > MEMORY_TTL_MS

    const updates: string[] = ['last_message_at = CURRENT_TIMESTAMP']
    if (memoryExpired) updates.push("turns_reset_at = datetime('now')")
    if (name && !existing.contact_name) updates.push(`contact_name = '${name.replace(/'/g, "''")}'`)

    await env.DB.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`)
      .bind(phone).run()

    const newTurnsResetAt = memoryExpired ? new Date().toISOString() : existing.turns_reset_at
    return {
      ...existing,
      contact_name: existing.contact_name ?? name,
      turns_reset_at: newTurnsResetAt,
    }
  }

  await env.DB.prepare(
    `INSERT INTO conversations (id, phone, contact_name, status, last_message_at)
     VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)`
  ).bind(phone, phone, name).run()

  return { id: phone, phone, contact_name: name, status: 'active', turns_reset_at: null, last_message_at: null, escalated_at: null, paused_until: null }
}

export async function isDuplicateMessage(_env: Env, _ycloudMsgId: string): Promise<boolean> {
  // Deprecated: deduplication now handled atomically in saveUserMessage
  return false
}

// Returns false if the message was already saved (duplicate), true if saved successfully
export async function saveUserMessage(
  env: Env,
  conversationId: string,
  content: string,
  ycloudMsgId: string
): Promise<boolean> {
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO messages (id, conversation_id, role, content, ycloud_message_id)
     VALUES (?, ?, 'user', ?, ?)`
  ).bind(crypto.randomUUID(), conversationId, content, ycloudMsgId).run()
  return (result.meta.changes ?? 0) > 0
}

export async function saveMessage(
  env: Env,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  ycloudMsgId?: string
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, ycloud_message_id)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), conversationId, role, content, ycloudMsgId ?? null).run()
}

export async function getRecentMessages(
  env: Env,
  conversationId: string,
  limit = 12,
  since?: string | null
): Promise<Message[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, conversation_id, role, content FROM messages
     WHERE conversation_id = ?
       AND role IN ('user', 'assistant')
       AND (? IS NULL OR created_at >= ?)
     ORDER BY created_at DESC LIMIT ?`
  ).bind(conversationId, since ?? null, since ?? null, limit).all<Message>()
  return results.reverse()
}

export async function getLatestUserMessage(env: Env, conversationId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT content FROM messages WHERE conversation_id = ? AND role = 'user'
     ORDER BY created_at DESC LIMIT 1`
  ).bind(conversationId).first<{ content: string }>()
  return row?.content ?? null
}

export async function markEscalated(env: Env, conversationId: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE conversations SET status = 'escalated', escalated_at = datetime('now') WHERE id = ?"
  ).bind(conversationId).run()
}

export async function updateConversationTimestamp(env: Env, conversationId: string): Promise<void> {
  await env.DB.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(conversationId).run()
}

export async function saveOrder(
  env: Env,
  conversationId: string,
  items: string,
  total: number | null,
  deliveryType: string | null,
  paymentMethod?: string | null,
  address?: string | null
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO orders (id, conversation_id, items, total, source, status, delivery_type, address, payment_method)
     VALUES (?, ?, ?, ?, 'whatsapp', 'confirmed', ?, ?, ?)`
  ).bind(crypto.randomUUID(), conversationId, items, total, deliveryType, address ?? null, paymentMethod ?? null).run()
}

export async function getKBEntries(env: Env): Promise<KBEntry[]> {
  const { results } = await env.DB.prepare(
    'SELECT id, question, answer, category FROM kb_cache WHERE active = 1'
  ).all<KBEntry>()
  return results
}

export async function getKBSyncAge(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT MAX(synced_at) as ts FROM kb_cache'
  ).first<{ ts: string | null }>()
  if (!row?.ts) return Infinity
  return Date.now() - new Date(row.ts).getTime()
}

export async function replaceKBCache(
  env: Env,
  entries: Array<{ question: string; answer: string; category: string; active: boolean }>
): Promise<void> {
  const stmts = [
    env.DB.prepare('DELETE FROM kb_cache'),
    ...entries.map((e) =>
      env.DB.prepare(
        'INSERT INTO kb_cache (id, question, answer, category, active, synced_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
      ).bind(crypto.randomUUID(), e.question, e.answer, e.category, e.active ? 1 : 0)
    ),
  ]
  await env.DB.batch(stmts)
}

export async function getMenuItems(env: Env): Promise<MenuItem[]> {
  const { results } = await env.DB.prepare(
    'SELECT category, product, description, price, available FROM menu_cache'
  ).all<{ category: string; product: string; description: string; price: number | null; available: number }>()
  return results.map((r) => ({
    category: r.category,
    product: r.product,
    description: r.description,
    price: r.price,
    available: r.available === 1,
  }))
}

export async function getMenuSyncAge(env: Env): Promise<number> {
  const row = await env.DB.prepare('SELECT MAX(synced_at) as ts FROM menu_cache').first<{ ts: string | null }>()
  if (!row?.ts) return Infinity
  return Date.now() - new Date(row.ts).getTime()
}

export async function replaceMenuCache(env: Env, items: MenuItem[]): Promise<void> {
  const stmts = [
    env.DB.prepare('DELETE FROM menu_cache'),
    ...items.map((m) =>
      env.DB.prepare(
        'INSERT INTO menu_cache (id, category, product, description, price, available, synced_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
      ).bind(crypto.randomUUID(), m.category, m.product, m.description, m.price, m.available ? 1 : 0)
    ),
  ]
  await env.DB.batch(stmts)
}

export async function pauseConversation(env: Env, conversationId: string, hours = 2): Promise<void> {
  await env.DB.prepare(
    `UPDATE conversations SET paused_until = datetime('now', '+${hours} hours') WHERE id = ?`
  ).bind(conversationId).run()
}

export async function getUserTurnCount(
  env: Env,
  conversationId: string,
  turnsResetAt: string | null
): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM messages
     WHERE conversation_id = ? AND role = 'user'
     AND created_at >= COALESCE(?, datetime('now', '-24 hours'))`
  ).bind(conversationId, turnsResetAt).first<{ c: number }>()
  return row?.c ?? 0
}
