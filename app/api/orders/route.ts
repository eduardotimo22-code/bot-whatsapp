import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sendTextMessage } from '@/lib/ycloud/sender'
import { nanoid } from 'nanoid'
import type { BotSettings } from '@/types'

interface OrderPayload {
  customer_phone: string
  customer_name?: string
  items: Array<{ name: string; qty: number; price: number }>
  total: number
  delivery_type?: 'delivery' | 'pickup'
  address?: string
  notes?: string
}

export async function POST(request: NextRequest) {
  // Authenticate with shared API key
  const apiKey = request.headers.get('x-api-key')
  const db = getDb()
  const storedKey = (db.prepare("SELECT value FROM settings WHERE key = 'orders_api_key'").get() as { value: string } | undefined)?.value
  const envKey = process.env.ORDERS_API_KEY

  const validKey = envKey || storedKey
  if (validKey && apiKey !== validKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: OrderPayload
  try {
    body = await request.json() as OrderPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { customer_phone, customer_name, items, total, delivery_type, address, notes } = body

  if (!customer_phone || !items?.length) {
    return NextResponse.json({ error: 'customer_phone and items are required' }, { status: 400 })
  }

  // Normalize phone (remove +)
  const phone = customer_phone.startsWith('+') ? customer_phone.slice(1) : customer_phone

  // Ensure conversation exists for this customer
  let conv = db.prepare('SELECT id FROM conversations WHERE phone = ?').get(phone) as { id: string } | undefined
  if (!conv) {
    const convId = nanoid()
    db.prepare(`
      INSERT INTO conversations (id, phone, contact_name, status, last_message_at)
      VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)
    `).run(convId, phone, customer_name ?? null)
    conv = { id: convId }
  }

  if (customer_name) {
    db.prepare('UPDATE conversations SET contact_name = ? WHERE phone = ? AND contact_name IS NULL').run(customer_name, phone)
  }

  // Build items summary
  const itemsSummary = items.map((i) => `${i.qty}x ${i.name} ($${i.price})`).join(', ')
  const itemsJson = JSON.stringify(items)

  // Save order to DB
  const orderId = nanoid()
  db.prepare(`
    INSERT INTO orders (id, conversation_id, items, total, source, status, delivery_type, address)
    VALUES (?, ?, ?, ?, 'website', 'confirmed', ?, ?)
  `).run(orderId, conv.id, itemsJson, total, delivery_type ?? null, address ?? null)

  // Log as a message in the conversation for full history
  const orderSummaryMsg = [
    `📦 *Pedido recibido desde la web*`,
    `Items: ${itemsSummary}`,
    delivery_type === 'delivery' ? `Entrega a domicilio: ${address ?? 'Sin dirección'}` : 'Recoger en tienda',
    notes ? `Notas: ${notes}` : null,
    `Total: $${total}`,
  ].filter(Boolean).join('\n')

  db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content)
    VALUES (?, ?, 'user', ?)
  `).run(nanoid(), conv.id, orderSummaryMsg)

  db.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(conv.id)

  // WhatsApp confirmation to customer
  const customerMsg = [
    `¡Hola${customer_name ? ' ' + customer_name : ''}! 🍕`,
    ``,
    `Recibimos tu pedido de *Pizza Juniors Cozumel*:`,
    itemsSummary,
    ``,
    delivery_type === 'delivery'
      ? `🚗 *Entrega a domicilio* — tiempo estimado: 30-45 min`
      : `🏪 *Recoger en tienda* — tu pedido estará listo en 20-25 min`,
    address ? `📍 Dirección: ${address}` : null,
    notes ? `📝 Nota: ${notes}` : null,
    ``,
    `💰 *Total: $${total}*`,
    ``,
    `¡Gracias por tu pedido! Te avisamos cuando esté en camino. 🛵`,
  ].filter((l) => l !== null).join('\n')

  try {
    await sendTextMessage(phone, customerMsg)
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content)
      VALUES (?, ?, 'assistant', ?)
    `).run(nanoid(), conv.id, customerMsg)
  } catch (err) {
    console.error('[orders] Customer WhatsApp send error:', err)
  }

  // Notify owner
  const settingsRows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value])) as unknown as BotSettings

  if (settings.owner_phone) {
    const ownerMsg = [
      `🍕 *Nuevo pedido desde la web*`,
      `👤 ${customer_name ?? 'Cliente'} (${customer_phone})`,
      `📋 ${itemsSummary}`,
      delivery_type === 'delivery' ? `🚗 Entrega: ${address ?? 'Sin dirección'}` : '🏪 Recoger en tienda',
      notes ? `📝 ${notes}` : null,
      `💰 Total: $${total}`,
      `🆔 Pedido: ${orderId}`,
    ].filter(Boolean).join('\n')

    try {
      await sendTextMessage(settings.owner_phone, ownerMsg)
    } catch (err) {
      console.error('[orders] Owner notify error:', err)
    }
  }

  return NextResponse.json({ ok: true, order_id: orderId }, { status: 201 })
}

// List orders (for dashboard)
export async function GET() {
  try {
    const db = getDb()
    const orders = db.prepare(`
      SELECT o.*, c.phone, c.contact_name
      FROM orders o
      LEFT JOIN conversations c ON c.id = o.conversation_id
      ORDER BY o.created_at DESC
      LIMIT 100
    `).all()
    return NextResponse.json(orders)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
