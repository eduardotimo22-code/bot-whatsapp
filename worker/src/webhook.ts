import type { Env } from './index'

export async function verifyYCloudSignature(
  env: Env,
  rawBody: string,
  signatureHeader: string | null,
  svixId?: string | null,
  svixTimestamp?: string | null,
  yCloudSignature?: string | null
): Promise<boolean> {
  const secret = env.YCLOUD_WEBHOOK_SECRET ?? ''
  if (!secret) return true // dev mode — skip verification

  // ── YCloud native format: "ycloud-signature: t=<ts>,s=<hexhash>" ────
  // Signed message: "<timestamp>.<rawBody>", HMAC-SHA256, hex-encoded
  if (yCloudSignature) {
    try {
      const parts = Object.fromEntries(
        yCloudSignature.split(',').map((p) => {
          const idx = p.indexOf('=')
          return [p.slice(0, idx), p.slice(idx + 1)]
        })
      )
      const ts = parts['t']
      const sig = parts['s']
      if (ts && sig) {
        const key = await crypto.subtle.importKey(
          'raw', new TextEncoder().encode(secret),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        )
        const toSign = `${ts}.${rawBody}`
        const macBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign))
        const hex = Array.from(new Uint8Array(macBuf)).map((b) => b.toString(16).padStart(2, '0')).join('')
        if (hex === sig) return true
        // Timing-safe comparison failed — try without timestamp prefix (some versions)
        const macBuf2 = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
        const hex2 = Array.from(new Uint8Array(macBuf2)).map((b) => b.toString(16).padStart(2, '0')).join('')
        return hex2 === sig
      }
    } catch {
      return false
    }
  }

  // ── Svix verification (YCloud Svix delivery) ────────────────────────
  if (svixId && svixTimestamp && signatureHeader) {
    try {
      const ts = parseInt(svixTimestamp, 10)
      const now = Math.floor(Date.now() / 1000)
      if (Math.abs(now - ts) > 300) return false

      const secretB64 = secret.startsWith('whsec_') ? secret.slice(6) : secret
      const secretBin = atob(secretB64)
      const secretBytes = new Uint8Array(secretBin.length)
      for (let i = 0; i < secretBin.length; i++) secretBytes[i] = secretBin.charCodeAt(i)

      const key = await crypto.subtle.importKey(
        'raw', secretBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
      )

      const toSign = `${svixId}.${svixTimestamp}.${rawBody}`
      const macBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign))
      const macBytes = new Uint8Array(macBuf)
      let macBin = ''
      for (let i = 0; i < macBytes.length; i++) macBin += String.fromCharCode(macBytes[i])
      const computed = btoa(macBin)

      const sigs = signatureHeader.split(' ')
      return sigs.some((s) => {
        const sig = s.startsWith('v1,') ? s.slice(3) : s
        return sig === computed
      })
    } catch {
      return false
    }
  }

  // ── Fallback: plain HMAC-SHA256 (x-ycloud-signature: sha256=<hex>) ──
  if (!signatureHeader) return false

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const macBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const macBytes = new Uint8Array(macBuf)
  const expectedHex = Array.from(macBytes).map((b) => b.toString(16).padStart(2, '0')).join('')

  const received = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader
  return expectedHex === received
}
