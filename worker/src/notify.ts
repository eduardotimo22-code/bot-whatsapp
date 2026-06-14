import type { Env } from './index'
import { sendTextMessage, sendTemplateMessage } from './ycloud'

function normalizePhone(phone: string): string {
  return phone.startsWith('+') ? phone.slice(1) : phone
}

export function getOwnerPhones(settings: Record<string, string>): string[] {
  try { return JSON.parse(settings.owner_phones ?? '[]') } catch { return [] }
}

// Meta prohíbe \n, tabs y >4 espacios consecutivos en parámetros de template,
// y el body completo (texto fijo + parámetros) tiene límite de 1024 caracteres
export function flattenForTemplate(text: string, maxLen = 900): string {
  const flat = text
    .replace(/\s*\n+\s*/g, ' | ')
    .replace(/\t/g, ' ')
    .replace(/ {4,}/g, '   ')
    .trim()
  return flat.length > maxLen ? flat.slice(0, maxLen - 1) + '…' : flat
}

// Notificación a owners garantizada fuera de la ventana de 24h de WhatsApp:
// template-first (los UTILITY templates se entregan siempre). El fallo de un
// mensaje libre fuera de ventana es asíncrono (error 131047), así que solo el
// template garantiza entrega. El fallback a texto cubre el caso de template
// aún no aprobado o mal configurado (esos fallos sí son síncronos).
export async function notifyOwners(env: Env, settings: Record<string, string>, text: string): Promise<void> {
  const ownerPhones = getOwnerPhones(settings)
  if (ownerPhones.length === 0) {
    console.warn('[notify] No owner phones configured — skipping notification')
    return
  }

  // owner_notify_template='false' → modo solo-texto (gratis) mientras no haya saldo
  // para templates. OJO: el texto libre solo llega si el owner tiene ventana de 24h
  // abierta; fuera de ventana falla asíncronamente (131047) y no se entera nadie.
  const useTemplate = settings.owner_notify_template !== 'false'
  const templateName = settings.owner_template_name || 'owner_notification'
  const templateLang = settings.owner_template_lang || 'es_MX'
  const botPhone = normalizePhone(env.YCLOUD_PHONE_NUMBER)

  for (const ownerPhone of ownerPhones) {
    if (normalizePhone(ownerPhone) === botPhone) {
      console.log(`[notify] Skipping self-notification (${ownerPhone})`)
      continue
    }

    if (!useTemplate) {
      try {
        const msgId = await sendTextMessage(env, ownerPhone, text)
        console.log(`[notify] Text-only sent to ${ownerPhone} — msgId: ${msgId}`)
      } catch (err) {
        console.error(`[notify] Text-only failed for ${ownerPhone}:`, err)
      }
      continue
    }

    try {
      const msgId = await sendTemplateMessage(env, ownerPhone, templateName, templateLang, [flattenForTemplate(text)])
      console.log(`[notify] Template sent to ${ownerPhone} — msgId: ${msgId}`)
    } catch (templateErr) {
      const errText = templateErr instanceof Error ? templateErr.message : String(templateErr)
      console.error(`[notify] Template failed for ${ownerPhone} (${errText}) — falling back to text`)
      try {
        const msgId = await sendTextMessage(env, ownerPhone, text)
        console.log(`[notify] Text fallback sent to ${ownerPhone} — msgId: ${msgId}`)
      } catch (textErr) {
        console.error(`[notify] Text fallback also failed for ${ownerPhone}:`, textErr)
      }
    }
  }
}
