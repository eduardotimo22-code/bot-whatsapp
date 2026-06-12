import type { Env } from './index'
import { getSettings } from './db'
import { sendTextMessage } from './ycloud'
import { notifyOwners } from './notify'
import { getCancunDateStr, getCancunTime } from './hours'

export async function sendOpeningFollowUp(env: Env): Promise<void> {
  // Don't send follow-ups on Wednesday (rest day) — cron fires daily so we check here
  if (getCancunTime().getUTCDay() === 3) {
    console.log('[followup] Wednesday — skipping follow-up')
    return
  }

  const todayStr = getCancunDateStr()

  const { results } = await env.DB.prepare(
    `SELECT id, contact_name FROM conversations
     WHERE offhours_notified_date = ? AND status = 'active'`
  ).bind(todayStr).all<{ id: string; contact_name: string | null }>()

  // Aviso de turno iniciado a los owners (vía template: llega aunque su ventana de 24h esté cerrada)
  const settings = await getSettings(env)
  await notifyOwners(env, settings, '🍕 Turno iniciado — Pizza Juniors abierto')

  console.log(`[followup] Sending opening follow-up to ${results.length} contacts`)

  for (const conv of results) {
    try {
      const name = conv.contact_name ? `, ${conv.contact_name.split(' ')[0]}` : ''
      const msg = `¡Buenas tardes${name}! 🍕 Ya estamos abiertos y listos para atenderte.\n\n¿Te gustaría ordenar algo? Dime qué se te antoja 😊`
      await sendTextMessage(env, conv.id, msg)
      await env.DB.prepare(
        'UPDATE conversations SET offhours_notified_date = NULL WHERE id = ?'
      ).bind(conv.id).run()
    } catch (err) {
      console.error(`[followup] Failed ${conv.id}:`, err)
    }
  }
}

export async function sendDailySalesReport(env: Env): Promise<void> {
  const { results: orders } = await env.DB.prepare(
    `SELECT conversation_id, items, total, delivery_type, payment_method, created_at
     FROM orders
     WHERE created_at >= datetime('now', '-24 hours')
     ORDER BY created_at ASC`
  ).all<{
    conversation_id: string
    items: string
    total: number | null
    delivery_type: string | null
    payment_method: string | null
    created_at: string
  }>()

  if (orders.length === 0) {
    console.log('[report] No orders today, skipping report')
    return
  }

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total ?? 0), 0)
  const settings = await getSettings(env)
  const todayStr = getCancunDateStr()

  const orderLines = orders.map((o, i) =>
    `${i + 1}. ${o.items} — $${o.total ?? '?'} (${o.delivery_type ?? '-'}, ${o.payment_method ?? '-'})`
  ).join('\n')

  const report = [
    `📊 *Reporte de ventas — ${todayStr}*`,
    ``,
    `🍕 Total pedidos: ${orders.length}`,
    `💰 Total facturado: $${totalRevenue}`,
    ``,
    `*Detalle:*`,
    orderLines,
  ].join('\n')

  await notifyOwners(env, settings, report)
}
