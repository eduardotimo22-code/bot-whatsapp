import type { Env } from './index'

const YCLOUD_BASE_URL = 'https://api.ycloud.com/v2'

function normalizePhone(phone: string): string {
  return phone.startsWith('+') ? phone.slice(1) : phone
}

async function ycloudRequest<T>(env: Env, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${YCLOUD_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': env.YCLOUD_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`YCloud API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

export async function sendTextMessage(env: Env, to: string, text: string): Promise<string> {
  const response = await ycloudRequest<{ id: string }>(env, 'POST', '/whatsapp/messages', {
    from: normalizePhone(env.YCLOUD_PHONE_NUMBER),
    to: normalizePhone(to),
    type: 'text',
    text: { body: text },
  })
  return response.id
}

export async function sendTemplateMessage(
  env: Env,
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[]
): Promise<string> {
  const response = await ycloudRequest<{ id: string }>(env, 'POST', '/whatsapp/messages', {
    from: normalizePhone(env.YCLOUD_PHONE_NUMBER),
    to: normalizePhone(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: bodyParams.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  })
  return response.id
}

export async function sendImageMessage(env: Env, to: string, imageUrl: string, caption?: string): Promise<string> {
  const payload: Record<string, unknown> = {
    from: normalizePhone(env.YCLOUD_PHONE_NUMBER),
    to: normalizePhone(to),
    type: 'image',
    image: { link: imageUrl },
  }
  if (caption) (payload.image as Record<string, string>).caption = caption
  const response = await ycloudRequest<{ id: string }>(env, 'POST', '/whatsapp/messages', payload)
  return response.id
}
