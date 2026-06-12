import type { Env } from './index'

function strToBase64url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleaned = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')

  const binaryString = atob(cleaned)
  const raw = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    raw[i] = binaryString.charCodeAt(i)
  }

  return crypto.subtle.importKey(
    'pkcs8',
    raw,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

async function getGoogleAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header = strToBase64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = strToBase64url(JSON.stringify({
    iss: env.GOOGLE_SHEETS_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }))

  const key = await importPrivateKey(env.GOOGLE_SHEETS_PRIVATE_KEY)
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claims}`)
  )

  const jwt = `${header}.${claims}.${bufferToBase64url(sigBuf)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const data = await res.json() as { access_token?: string; error?: string; error_description?: string }

  if (!data.access_token) {
    throw new Error(`Google OAuth error: ${data.error} — ${data.error_description}`)
  }

  return data.access_token
}

export async function getSheetValues(env: Env, range: string): Promise<string[][]> {
  const token = await getGoogleAccessToken(env)
  const spreadsheetId = encodeURIComponent(env.GOOGLE_SHEETS_SPREADSHEET_ID)
  const encodedRange = encodeURIComponent(range)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Sheets error ${res.status}: ${text}`)
  }

  const data = await res.json() as { values?: string[][] }
  return data.values ?? []
}
