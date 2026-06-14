import { verifyYCloudSignature } from './webhook'
import { processMessage } from './processor'
import { getOrCreateConversation, isDuplicateMessage, saveMessage, saveUserMessage, getSettings } from './db'
import { syncKBFromSheets } from './knowledge'
import { syncMenuFromSheets } from './menu'
import { sendTextMessage } from './ycloud'
import { isBusinessOpen, getCancunDateStr } from './hours'
import { sendOpeningFollowUp, sendDailySalesReport } from './scheduler'
import { normalizePhone, phoneInList, parseDbDateMs } from './phone'

export interface Env {
  DB: D1Database
  MENU_IMAGES: KVNamespace
  OPENAI_API_KEY: string
  YCLOUD_API_KEY: string
  YCLOUD_PHONE_NUMBER: string
  GOOGLE_SHEETS_CLIENT_EMAIL: string
  GOOGLE_SHEETS_PRIVATE_KEY: string
  GOOGLE_SHEETS_SPREADSHEET_ID: string
  YCLOUD_WEBHOOK_SECRET?: string
  ORDERS_API_KEY?: string
}

interface YCloudInboundMessage {
  id: string
  from: string
  customerProfile?: { name: string }
  type: string
  text?: { body: string }
}

interface YCloudEvent {
  id: string
  type: string
  whatsappInboundMessage?: YCloudInboundMessage
}

// Mensajes generados por el propio bot (notificaciones a owners, escalado, reporte,
// datos bancarios). Si reaparecen como entrantes (reenvíos, eco), NO deben procesarse
// como mensaje de cliente: eso causa el bucle de retroalimentación que vimos.
function isBotGeneratedMessage(text: string): boolean {
  const t = text.trimStart()
  const signatures = [
    '🍕 *Nuevo pedido confirmado*',
    '⚠️ *Escalado al humano*',
    '📊 *Reporte de ventas',
    '🍕 Turno iniciado',
    '🏦 Aquí están nuestros datos',
    '🧾 *Total a pagar',
  ]
  return signatures.some((s) => t.startsWith(s))
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)

    console.log('[fetch]', req.method, url.pathname)

    if (req.method === 'GET' && url.pathname === '/') {
      return new Response('Pizza Juniors Bot v1 ✅', { status: 200 })
    }

    // Accept both /webhook and /api/webhook for compatibility
    const isWebhookPath = url.pathname === '/webhook' || url.pathname === '/api/webhook'

    // YCloud webhook challenge verification
    if (req.method === 'GET' && isWebhookPath) {
      const challenge = url.searchParams.get('hub.challenge')
      if (challenge) return new Response(challenge, { status: 200 })
      return json({ ok: true })
    }

    if (req.method === 'POST' && isWebhookPath) {
      return handleWebhook(req, env, ctx)
    }

    // Serve menu images stored in KV
    if (req.method === 'GET' && url.pathname.startsWith('/menu/')) {
      const filename = url.pathname.slice('/menu/'.length)
      const data = await env.MENU_IMAGES.get(filename, 'arrayBuffer')
      if (!data) return new Response('Not found', { status: 404 })
      return new Response(data, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    // Manual KB sync trigger — protected by ORDERS_API_KEY if set
    if (req.method === 'POST' && url.pathname === '/sync-kb') {
      const apiKey = req.headers.get('x-api-key')
      if (env.ORDERS_API_KEY && apiKey !== env.ORDERS_API_KEY) {
        return json({ error: 'unauthorized' }, 401)
      }
      ctx.waitUntil(Promise.all([syncKBFromSheets(env), syncMenuFromSheets(env)]))
      return json({ ok: true, message: 'KB + menu sync triggered' })
    }

    return json({ error: 'not found' }, 404)
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Interruptor global: bot apagado → no corren los crons (reporte, follow-up, sync KB)
    const settings = await getSettings(env)
    if (settings.bot_paused === 'true') {
      console.log('[scheduled] Bot paused (bot_paused=true) — skipping cron', event.cron)
      return
    }

    if (event.cron === '41 4 * * *') {
      ctx.waitUntil(sendDailySalesReport(env))
    } else if (event.cron === '0 22 * * *') {
      ctx.waitUntil(sendOpeningFollowUp(env))
    } else {
      ctx.waitUntil(Promise.all([syncKBFromSheets(env), syncMenuFromSheets(env)]))
    }
  },
}

async function handleWebhook(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    // Interruptor global: bot apagado → ignora todo el tráfico entrante (responde 200
    // para que YCloud no reintente). Reversible cambiando el setting bot_paused en D1.
    const settings = await getSettings(env)
    if (settings.bot_paused === 'true') {
      console.log('[webhook] Bot paused (bot_paused=true) — ignoring inbound message')
      return json({ ok: true })
    }

    const rawBody = await req.text()
    // YCloud real requests use "ycloud-signature: t=<ts>,s=<hex>"
    // Svix-based delivery uses svix-* headers
    const yCloudSig = req.headers.get('ycloud-signature')
    const signature = req.headers.get('svix-signature') ?? req.headers.get('x-ycloud-signature')
    const svixId = req.headers.get('svix-id')
    const svixTs = req.headers.get('svix-timestamp')

    console.log('[webhook] sig headers:', { yCloudSig: !!yCloudSig, svixSig: !!signature, svixId: !!svixId })

    const valid = await verifyYCloudSignature(env, rawBody, signature, svixId, svixTs, yCloudSig)
    if (!valid) {
      console.error('[webhook] Invalid signature')
      return json({ error: 'invalid signature' }, 401)
    }

    const event: YCloudEvent = JSON.parse(rawBody)
    console.log('[webhook] type:', event.type, '| body preview:', rawBody.slice(0, 200))

    if (event.type !== 'whatsapp.inbound_message.received') {
      return json({ ok: true })
    }

    // Support both top-level and data-wrapped message (YCloud format variants)
    const rawEvent = event as unknown as Record<string, unknown>
    const msg = event.whatsappInboundMessage
      ?? (rawEvent.data as Record<string, unknown>)?.whatsappInboundMessage as YCloudInboundMessage | undefined

    console.log('[webhook] msg type:', msg?.type, '| from:', msg?.from, '| text:', msg?.text?.body?.slice(0, 50))

    if (!msg) {
      return json({ ok: true })
    }

    // Contenido no-texto (audio, imagen, video, sticker, documento): no podemos
    // procesarlo, pero NO lo ignoramos en silencio — el cliente creería que no lo
    // atendemos. Avisamos (solo dentro de horario) que escriba en texto.
    const NON_TEXT_TYPES = ['audio', 'voice', 'image', 'video', 'sticker', 'document']
    if (msg.type !== 'text' || !msg.text?.body?.trim()) {
      if (NON_TEXT_TYPES.includes(msg.type) && isBusinessOpen()) {
        const ask = 'Por ahora solo puedo leer mensajes de *texto* 🙏 Escríbeme tu pedido o tu pregunta y con gusto te atiendo 😊'
        ctx.waitUntil(sendTextMessage(env, normalizePhone(msg.from), ask).catch(console.error))
      }
      return json({ ok: true })
    }

    // Corta el bucle: si el entrante es una notificación generada por el bot,
    // se ignora (no se guarda como turno, no escala, no dispara IA).
    if (isBotGeneratedMessage(msg.text.body)) {
      console.log('[webhook] Bot-generated message echoed back — ignoring:', msg.from)
      return json({ ok: true })
    }

    const phone = normalizePhone(msg.from)
    const contactName = msg.customerProfile?.name ?? null

    const conv = await getOrCreateConversation(env, phone, contactName)

    // Guardado atómico: si ya existe el ycloud_message_id, el INSERT OR IGNORE no inserta
    // y sabemos que es un duplicado — sin condición de carrera
    const saved = await saveUserMessage(env, phone, msg.text.body, msg.id)
    if (!saved) {
      console.log('[webhook] Duplicate message ignored:', msg.id)
      return json({ ok: true })
    }

    // Detectar comando PAUSA enviado desde un owner phone
    const ownerPhones: string[] = JSON.parse(settings.owner_phones ?? '[]')
    const isOwner = phoneInList(phone, ownerPhones)

    // Verificar horario de atención — owners nunca están bloqueados
    if (!isOwner && !isBusinessOpen()) {
      const todayStr = getCancunDateStr()
      const convMeta = await env.DB.prepare(
        'SELECT offhours_notified_date FROM conversations WHERE id = ?'
      ).bind(phone).first<{ offhours_notified_date: string | null }>()

      if (convMeta?.offhours_notified_date !== todayStr) {
        await env.DB.prepare(
          'UPDATE conversations SET offhours_notified_date = ? WHERE id = ?'
        ).bind(todayStr, phone).run()
        const offHoursMsg = `¡Hola! 👋 Gracias por escribirnos.\n\nActualmente estamos fuera de nuestro horario de atención.\n\n🕔 *Horario:* Jueves a Martes de 5:00 PM a 11:40 PM\n📅 *Descansamos:* Miércoles\n\n¡Te contactaremos al inicio de nuestro próximo turno! 😊`
        ctx.waitUntil(sendTextMessage(env, phone, offHoursMsg).catch(console.error))
      }
      return json({ ok: true })
    }

    if (isOwner && msg.text.body.trim().toUpperCase().startsWith('PAUSA')) {
      const targetRaw = msg.text.body.trim().slice(5).trim()
      const targetPhone = normalizePhone(targetRaw)
      if (targetPhone.length >= 10) {
        await env.DB.prepare(
          "UPDATE conversations SET paused_until = datetime('now', '+2 hours') WHERE id = ?"
        ).bind(targetPhone).run()
        await sendTextMessage(env, phone, `⏸️ Conversación de ${targetPhone} pausada 2 horas. El bot retomará automáticamente.`)
        console.log(`[webhook] Owner ${phone} paused ${targetPhone} for 2h`)
      }
      return json({ ok: true })
    }

    if (isOwner && msg.text.body.trim().toUpperCase().startsWith('ACTIVAR')) {
      const targetRaw = msg.text.body.trim().slice(7).trim()
      const targetPhone = normalizePhone(targetRaw)
      if (targetPhone.length >= 10) {
        await env.DB.prepare(
          "UPDATE conversations SET paused_until = NULL, status = 'active', escalated_at = NULL WHERE id = ?"
        ).bind(targetPhone).run()
        await sendTextMessage(env, phone, `▶️ Bot reactivado para ${targetPhone}. Ya responde normalmente.`)
        console.log(`[webhook] Owner ${phone} reactivated ${targetPhone}`)
      }
      return json({ ok: true })
    }

    if (conv.status === 'escalated') {
      const noEscalate: string[] = JSON.parse(settings.no_escalate_phones ?? '[]')
      const whitelisted = phoneInList(phone, noEscalate)

      // Calcular horas desde que se escaló
      const escalatedAt = (conv as unknown as { escalated_at: string | null }).escalated_at
      const hoursEscalated = escalatedAt
        ? (Date.now() - parseDbDateMs(escalatedAt)) / 3_600_000
        : 999 // sin fecha = forzar reset

      if (!whitelisted && hoursEscalated < 24) return json({ ok: true })

      // Reset: whitelist siempre, o tras 24h para cualquier conversación
      await env.DB.prepare(
        "UPDATE conversations SET status = 'active', turns_reset_at = datetime('now'), escalated_at = NULL WHERE id = ?"
      ).bind(phone).run()
    }

    // Chequeo de pausa manual — owners nunca bloqueados por pausa
    const pausedUntil = conv.paused_until
    if (!isOwner && pausedUntil) {
      const pauseExpired = parseDbDateMs(pausedUntil) < Date.now()
      if (!pauseExpired) {
        console.log(`[webhook] ${phone} paused until ${pausedUntil}, skipping`)
        return json({ ok: true })
      }
      await env.DB.prepare('UPDATE conversations SET paused_until = NULL WHERE id = ?').bind(phone).run()
    }

    // Fire AI processing after returning 200 to YCloud
    ctx.waitUntil(
      processMessage(env, phone).catch((err) =>
        console.error('[webhook] AI processing error:', err)
      )
    )

    return json({ ok: true })
  } catch (err) {
    console.error('[webhook] Error:', err)
    return json({ error: 'internal' }, 500)
  }
}
