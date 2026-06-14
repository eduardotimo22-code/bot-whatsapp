import type { Env } from './index'
import { buildContext } from './context-builder'
import { checkEscalation, buildEscalationMessages } from './escalation'
import { sendTextMessage, sendImageMessage } from './ycloud'
import { notifyOwners, getOwnerPhones } from './notify'
import { getMenuText } from './menu'
import { computeOrderTotal, getPriceTable } from './pricing'
import { phoneInList } from './phone'
import {
  getSettings,
  getLatestUserMessage,
  saveMessage,
  markEscalated,
  saveOrder,
  updateConversationTimestamp,
  getRecentMessages,
  getUserTurnCount,
} from './db'

function normalizePhone(phone: string): string {
  return phone.startsWith('+') ? phone.slice(1) : phone
}

// Solo frases explícitas de "muestrame el menú" disparan las fotos
// Las preguntas sobre productos/precios las responde GPT con el menú en el system prompt
const MENU_TRIGGERS = [
  'ver el menú', 'ver el menu', 'manda el menú', 'manda el menu',
  'envía el menú', 'envía el menu', 'mándame el menu', 'mándame el menú',
  'envíame el menu', 'envíame el menú', 'muéstrame el menú', 'muéstrame el menu',
  'quiero el menú', 'quiero el menu', 'foto del menú', 'foto del menu',
  'fotos del menú', 'fotos del menu', 'show menu', "what's the menu",
]

function isMenuRequest(message: string): boolean {
  const lower = message.toLowerCase().trim()
  // Coincidencia exacta de frase completa
  if (MENU_TRIGGERS.some((t) => lower.includes(t))) return true
  // Mensaje que es SOLO la palabra "menú" o "menu" (nada más)
  return lower === 'menú' || lower === 'menu'
}

// Pedidos pre-formateados enviados desde el sitio web
function isWebsiteOrder(message: string): boolean {
  return message.includes('💰 Total:') || message.includes('📋 Mis datos:')
}

// Extrae el valor de items= de un tag [CARRITO: ...] o [PEDIDO_CONFIRMADO: ...].
// items puede contener comas, así que se corta hasta el siguiente campo conocido o ']'.
function parseItems(tag: string): string {
  return tag.match(/items=([\s\S]+?)(?:,\s*(?:tipo|total|nombre|pago|direccion)=|\])/)?.[1]?.trim() ?? ''
}

// phone is also used as conversationId
export async function processMessage(env: Env, phone: string): Promise<void> {
  const latestMessage = await getLatestUserMessage(env, phone)
  if (!latestMessage) return

  // Shortcut: send menu photos directly without calling GPT
  if (isMenuRequest(latestMessage)) {
    try {
      const baseUrl = 'https://pizza-juniors-bot.eduardo-timo22.workers.dev'
      const total = 7
      for (let i = 1; i <= total; i++) {
        const url = `${baseUrl}/menu/menu${i}.jpg`
        const caption = i === 1 ? '🍕 Menú Pizza Juniors Cozumel' : undefined
        // try/catch por imagen: si una falla, las demás sí se envían
        try {
          await sendImageMessage(env, phone, url, caption)
        } catch (imgErr) {
          console.error(`[processor] Menu image ${i} failed:`, imgErr)
        }
      }
      const confirmText = '¿Te antojó algo? Dime qué quieres ordenar 😊'
      await sendTextMessage(env, phone, confirmText)
      await saveMessage(env, phone, 'assistant', `[Menú enviado — ${total} fotos]`)
      await updateConversationTimestamp(env, phone)
      console.log(`[processor] Sent menu images to ${phone}`)
    } catch (err) {
      console.error('[processor] Menu send error:', err)
    }
    return
  }

  // Obtener turns_reset_at antes de buildContext para filtrar historial y contar turnos
  const convInfo = await env.DB.prepare(
    'SELECT turns_reset_at FROM conversations WHERE id = ?'
  ).bind(phone).first<{ turns_reset_at: string | null }>()

  // Load settings and build GPT context in parallel
  const [settings, context] = await Promise.all([
    getSettings(env),
    buildContext(env, phone, latestMessage, convInfo?.turns_reset_at),
  ])

  // Call OpenAI via fetch
  let aiResponse: string
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: context.systemPrompt },
          ...context.history,
          { role: 'user', content: context.latestMessage },
        ],
        max_tokens: 1000,
        temperature: 0.2,
      }),
    })

    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    aiResponse = data.choices[0]?.message?.content ?? 'Lo siento, no pude procesar tu mensaje.'
  } catch (err) {
    console.error('[processor] OpenAI error:', err)
    aiResponse = 'En este momento tenemos dificultades técnicas. Por favor, inténtalo de nuevo en unos minutos.'
  }

  const orderMatch = aiResponse.match(/\[PEDIDO_CONFIRMADO:[^\]]+\]/)
  const cartMatch = aiResponse.match(/\[CARRITO:[^\]]+\]/)
  let cleanResponse = aiResponse
    .replace(/\[PEDIDO_CONFIRMADO:[^\]]+\]\s*/g, '')
    .replace(/\[CARRITO:[^\]]+\]\s*/g, '')
    .trim()

  console.log(`[processor] (${phone}) "${cleanResponse.slice(0, 100)}" | order: ${!!orderMatch} | cart: ${!!cartMatch}`)

  // Subtotal EN VIVO: el modelo nunca escribe dinero; el código lo calcula y lo anexa.
  // Solo cuando hay carrito en progreso y aún NO es pedido confirmado. Si algún item
  // no se puede cotizar, NO mostramos número (fallo seguro) — el modelo sigue armando.
  if (cartMatch && !orderMatch) {
    try {
      const priceTable = await getPriceTable(env)
      const priced = computeOrderTotal(parseItems(cartMatch[0]), priceTable)
      if (priced.unmatched.length === 0 && priced.total > 0) {
        cleanResponse += `\n\n🧾 Subtotal: $${priced.total}`
      }
    } catch (err) {
      console.error('[processor] Cart subtotal error:', err)
    }
  }

  // Pedidos del sitio web, owners y teléfonos en whitelist nunca escalan.
  // Un pedido en curso (carrito) tampoco debe escalar por número de turnos.
  const noEscalate: string[] = JSON.parse(settings.no_escalate_phones ?? '[]')
  const neverEscalate = [...noEscalate, ...getOwnerPhones(settings)]
  const isWhitelisted = phoneInList(phone, neverEscalate)

  if (!orderMatch && !cartMatch && !isWebsiteOrder(latestMessage) && !isWhitelisted) {
    const turnCount = await getUserTurnCount(env, phone, convInfo?.turns_reset_at ?? null)
    const escalation = checkEscalation(latestMessage, cleanResponse, settings, turnCount)

    if (escalation.shouldEscalate) {
      await handleEscalation(env, phone, escalation.reason, settings)
      return
    }
  }

  let ycloudMsgId: string | undefined
  try {
    ycloudMsgId = await sendTextMessage(env, phone, cleanResponse)
  } catch (err) {
    console.error('[processor] Send error:', err)
  }
  await saveMessage(env, phone, 'assistant', cleanResponse, ycloudMsgId)

  if (orderMatch) {
    const contactRow = await env.DB.prepare(
      'SELECT contact_name FROM conversations WHERE id = ?'
    ).bind(phone).first<{ contact_name: string | null }>()
    await handleOrderConfirmation(env, orderMatch[0], phone, contactRow?.contact_name ?? phone, settings)
  }

  await updateConversationTimestamp(env, phone)
}

async function handleOrderConfirmation(
  env: Env,
  tag: string,
  phone: string,
  contactName: string,
  settings: Record<string, string>
): Promise<void> {
  const getField = (key: string) => tag.match(new RegExp(`${key}=([^,\\]]+)`))?.[1]?.trim() ?? ''
  const nombre = getField('nombre')
  const items = parseItems(tag)
  const tipo = getField('tipo')
  const pago = getField('pago')
  // direccion va al FINAL del tag y puede contener comas, así que se captura
  // hasta el cierre ']' (no con getField, que corta en la primera coma).
  const direccionRaw = tag.match(/direccion=([^\]]+)/)?.[1]?.trim() ?? ''
  const direccion = /^(n\/?a|na|-|)$/i.test(direccionRaw) ? '' : direccionRaw
  const isDelivery = tipo.toLowerCase().includes('entrega')

  // Total AUTORITATIVO calculado SIEMPRE en código. NUNCA se usa el número del modelo.
  // Fallo seguro: si algún item no se puede cotizar, NO se le da un total al cliente —
  // se marca REVISAR PRECIO para el dueño. Nunca mostramos un monto inventado.
  const priceTable = await getPriceTable(env)
  const priced = computeOrderTotal(items, priceTable)
  const verified = priced.unmatched.length === 0 && priced.total > 0
  const finalTotal = verified ? priced.total : null

  await saveOrder(env, phone, items, finalTotal, tipo || null, pago || null, isDelivery ? direccion || null : null)

  const msg = [
    '🍕 *Nuevo pedido confirmado*',
    `👤 Cliente: ${nombre || contactName} (${phone})`,
    `📋 Items: ${items}`,
    verified
      ? `💰 Total: $${priced.total}`
      : `⚠️ REVISAR PRECIO — no se pudo cotizar automáticamente${priced.unmatched.length ? ` (revisar: ${priced.unmatched.join(', ')})` : ''}`,
    tipo && `🚗 Tipo: ${tipo}`,
    isDelivery && `📍 Dirección: ${direccion || '⚠️ FALTA — pídela al cliente'}`,
    pago && `💳 Pago: ${pago}`,
  ].filter(Boolean).join('\n')

  await notifyOwners(env, settings, msg)

  // El cliente solo ve un total calculado por el código. Si no se pudo cotizar, no se
  // le manda un número: se le avisa que el equipo confirma el total.
  if (verified) {
    await sendTextMessage(env, phone, `🧾 *Total a pagar: $${priced.total}*`)
      .catch((err) => console.error('[order] Total message send error:', err))
  } else {
    await sendTextMessage(env, phone, '¡Listo! Tu pedido quedó registrado 🙌 En un momento el equipo te confirma el total. 🙏')
      .catch((err) => console.error('[order] Pending-total message send error:', err))
  }

  if (pago.toLowerCase().includes('transferencia')) {
    const baseUrl = 'https://pizza-juniors-bot.eduardo-timo22.workers.dev'
    await sendImageMessage(env, phone, `${baseUrl}/menu/transfer_info.jpg`,
      '🏦 Aquí están nuestros datos bancarios para tu transferencia:')
      .catch((err) => console.error('[order] Transfer image send error:', err))
  }
}

async function handleEscalation(
  env: Env,
  phone: string,
  reason: string | null,
  settings: Record<string, string>
): Promise<void> {
  await markEscalated(env, phone)

  const msgs = buildEscalationMessages(reason)

  // NO guardamos el mensaje de escalado en el historial: si queda como 'assistant',
  // el modelo aprende a repetir "Tu consulta requiere una atención más detallada…"
  // y lo mezcla con respuestas de precio en conversaciones siguientes.
  try {
    await sendTextMessage(env, phone, msgs.toUser)
  } catch (err) {
    console.error('[processor] Escalation user notify error:', err)
  }

  const ownerPhones = getOwnerPhones(settings)
  if (ownerPhones.length > 0) {
    const recentMessages = await getRecentMessages(env, phone, 6)
    const summary = recentMessages
      .map((m) => `${m.role === 'user' ? '👤' : '🤖'} ${m.content}`)
      .join('\n')

    const contactRow = await env.DB.prepare(
      'SELECT contact_name FROM conversations WHERE id = ?'
    ).bind(phone).first<{ contact_name: string | null }>()

    const ownerMsg = msgs.toOwner(contactRow?.contact_name ?? 'Sin nombre', phone, summary)

    for (const ownerPhone of ownerPhones) {
      try {
        await sendTextMessage(env, ownerPhone, ownerMsg)
      } catch (err) {
        console.error(`[processor] Owner notify error (${ownerPhone}):`, err)
      }
    }
  }
}
