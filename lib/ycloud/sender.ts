import { ycloudRequest } from './client'

interface SendTextResponse {
  id: string
  status: string
}

function getFromNumber(): string {
  const num = process.env.YCLOUD_PHONE_NUMBER
  if (!num) throw new Error('YCLOUD_PHONE_NUMBER is not set')
  return num
}

// YCloud acepta números sin el prefijo +
function normalizePhone(phone: string): string {
  return phone.startsWith('+') ? phone.slice(1) : phone
}

export async function sendTextMessage(to: string, text: string): Promise<string> {
  const response = await ycloudRequest<SendTextResponse>('POST', '/whatsapp/messages', {
    from: normalizePhone(getFromNumber()),
    to: normalizePhone(to),
    type: 'text',
    text: { body: text },
  })
  return response.id
}

export async function sendGroupMessage(groupId: string, text: string): Promise<string> {
  const response = await ycloudRequest<SendTextResponse>('POST', '/whatsapp/messages', {
    from: normalizePhone(getFromNumber()),
    to: groupId,
    type: 'text',
    text: { body: text },
  })
  return response.id
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  components?: unknown[]
): Promise<string> {
  const response = await ycloudRequest<SendTextResponse>('POST', '/whatsapp/messages', {
    from: normalizePhone(getFromNumber()),
    to: normalizePhone(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components ?? [],
    },
  })
  return response.id
}
