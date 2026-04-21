import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyYCloudSignature } from '@/lib/ycloud/webhook'
import { processMessage } from '@/lib/ai/processor'
import { nanoid } from 'nanoid'

interface YCloudEvent {
  id: string
  type: string
  apiVersion: string
  createTime: string
  whatsappInboundMessage?: {
    id: string
    wamid: string
    wabaId: string
    from: string
    customerProfile?: { name: string }
    to: string
    sendTime: string
    type: string
    text?: { body: string }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const challenge = searchParams.get('hub.challenge')
  if (challenge) return new NextResponse(challenge, { status: 200 })
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('svix-signature') ?? request.headers.get('x-ycloud-signature')
    const svixId    = request.headers.get('svix-id')
    const svixTs    = request.headers.get('svix-timestamp')

    if (!verifyYCloudSignature(rawBody, signature, svixId, svixTs)) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
    }

    const event: YCloudEvent = JSON.parse(rawBody)

    if (event.type !== 'whatsapp.inbound_message.received') {
      return NextResponse.json({ ok: true })
    }

    const msg = event.whatsappInboundMessage
    if (!msg || msg.type !== 'text' || !msg.text?.body?.trim()) {
      return NextResponse.json({ ok: true })
    }

    // Log group JIDs so admins can register them in settings
    if (msg.from?.includes('@g.us')) {
      console.log(`[webhook] GROUP MESSAGE — JID: ${msg.from} | sender: ${(msg as unknown as Record<string,string>).participant ?? 'unknown'} | text: ${msg.text?.body?.slice(0,50)}`)
    }

    await processIncomingMessage(
      msg.id,
      msg.from,
      msg.text.body,
      msg.customerProfile?.name ?? null
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook] Error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

function normalizePhone(phone: string): string {
  return phone.startsWith('+') ? phone.slice(1) : phone
}

async function processIncomingMessage(
  msgId: string,
  rawPhone: string,
  text: string,
  contactName: string | null
) {
  const db = getDb()
  const phone = normalizePhone(rawPhone)

  const existing = db.prepare('SELECT id, status FROM conversations WHERE id = ?').get(phone) as
    | { id: string; status: string }
    | undefined

  if (!existing) {
    db.prepare(`
      INSERT INTO conversations (id, contact_name, phone, status, last_message_at)
      VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)
    `).run(phone, contactName, phone)

    db.prepare(`
      INSERT OR IGNORE INTO contacts (id, phone, name, source)
      VALUES (?, ?, ?, 'whatsapp')
    `).run(nanoid(), phone, contactName)
  } else {
    db.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(phone)
    if (contactName) {
      db.prepare('UPDATE conversations SET contact_name = ? WHERE id = ? AND contact_name IS NULL').run(contactName, phone)
    }
  }

  // Dedup por message id
  const dup = db.prepare('SELECT id FROM messages WHERE ycloud_message_id = ?').get(msgId)
  if (dup) return

  db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, ycloud_message_id)
    VALUES (?, ?, 'user', ?, ?)
  `).run(nanoid(), phone, text, msgId)

  if (existing?.status === 'escalated') return

  processMessage(phone).catch((err) =>
    console.error('[webhook] AI processing error:', err)
  )
}
