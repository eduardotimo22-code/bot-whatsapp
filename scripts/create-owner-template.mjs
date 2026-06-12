// Crea (o consulta) el template de WhatsApp "owner_notification" vía YCloud API.
// Uso:
//   node scripts/create-owner-template.mjs          → crea el template
//   node scripts/create-owner-template.mjs status   → consulta estado de aprobación de Meta
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Parser mínimo de .env para no depender de dotenv
for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const API_KEY = process.env.YCLOUD_API_KEY
const BOT_PHONE = (process.env.YCLOUD_PHONE_NUMBER ?? '').replace(/^\+/, '')
if (!API_KEY || !BOT_PHONE) {
  console.error('❌ Faltan YCLOUD_API_KEY o YCLOUD_PHONE_NUMBER en .env')
  process.exit(1)
}

const TEMPLATE_NAME = 'owner_notification'
const TEMPLATE_LANG = 'es_MX'
const BODY_TEXT = '🍕 Pizza Juniors — aviso interno del bot: {{1}}. Este es un mensaje automático del sistema de pedidos.'
const BODY_EXAMPLE = 'Nuevo pedido confirmado | Cliente: Juan Pérez (5219871234567) | Items: 1 Pizza Grande Hawaiana | Total: $250 | Tipo: domicilio | Pago: efectivo'

async function ycloud(method, path, body) {
  const res = await fetch(`https://api.ycloud.com/v2${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  if (!res.ok) throw new Error(`YCloud ${res.status}: ${text}`)
  return data
}

async function getWabaId() {
  const data = await ycloud('GET', '/whatsapp/phoneNumbers')
  const numbers = data.items ?? data
  const match = numbers.find((n) => (n.phoneNumber ?? '').replace(/^\+/, '') === BOT_PHONE)
  if (!match?.wabaId) {
    console.error('❌ No se encontró el número del bot en YCloud. Números disponibles:')
    numbers.forEach((n) => console.error(`  • ${n.phoneNumber} (wabaId: ${n.wabaId})`))
    process.exit(1)
  }
  return match.wabaId
}

async function showStatus(wabaId) {
  const data = await ycloud('GET', `/whatsapp/templates?wabaId=${encodeURIComponent(wabaId)}&limit=100`)
  const templates = (data.items ?? []).filter((t) => t.name === TEMPLATE_NAME)
  if (templates.length === 0) {
    console.log(`⚠️ El template "${TEMPLATE_NAME}" no existe todavía. Créalo con: node scripts/create-owner-template.mjs`)
    return
  }
  for (const t of templates) {
    const icon = t.status === 'APPROVED' ? '✅' : t.status === 'REJECTED' ? '❌' : '⏳'
    console.log(`${icon} ${t.name} (${t.language}) — estado: ${t.status}${t.reason ? ` | motivo: ${t.reason}` : ''}`)
  }
}

async function createTemplate(wabaId) {
  try {
    const result = await ycloud('POST', '/whatsapp/templates', {
      wabaId,
      name: TEMPLATE_NAME,
      language: TEMPLATE_LANG,
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: BODY_TEXT,
          example: { body_text: [[BODY_EXAMPLE]] },
        },
      ],
    })
    console.log(`✅ Template "${TEMPLATE_NAME}" (${TEMPLATE_LANG}) enviado a revisión de Meta — estado: ${result.status ?? 'PENDING'}`)
    console.log('   La aprobación suele tardar de minutos a horas. Consulta con:')
    console.log('   node scripts/create-owner-template.mjs status')
  } catch (err) {
    if (String(err).toLowerCase().includes('exist')) {
      console.log(`ℹ️ El template "${TEMPLATE_NAME}" ya existe. Estado actual:`)
      await showStatus(wabaId)
    } else {
      throw err
    }
  }
}

const wabaId = await getWabaId()
console.log(`📞 WABA: ${wabaId} (número ${BOT_PHONE})`)
if (process.argv[2] === 'status') {
  await showStatus(wabaId)
} else {
  await createTemplate(wabaId)
}
