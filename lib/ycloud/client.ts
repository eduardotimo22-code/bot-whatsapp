const YCLOUD_BASE_URL = 'https://api.ycloud.com/v2'

function getApiKey(): string {
  const key = process.env.YCLOUD_API_KEY
  if (!key) throw new Error('YCLOUD_API_KEY is not set')
  return key
}

export async function ycloudRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${YCLOUD_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': getApiKey(),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`YCloud API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}
