import { createHmac } from 'crypto'

/**
 * YCloud uses Svix for webhook delivery.
 * Verification: https://docs.svix.com/receiving/verifying-payloads/how
 *
 * Headers sent by Svix:
 *   svix-id        — unique message ID
 *   svix-timestamp — unix timestamp (seconds)
 *   svix-signature — "v1,<base64>" (space-separated if multiple)
 */
export function verifyYCloudSignature(
  rawBody: string,
  signatureHeader: string | null,
  svixId?: string | null,
  svixTimestamp?: string | null,
): boolean {
  const secret = process.env.YCLOUD_WEBHOOK_SECRET
  if (!secret) return true // dev mode — skip verification

  // ── Svix verification ──────────────────────────────────────────────
  if (svixId && svixTimestamp && signatureHeader) {
    try {
      // Reject messages older than 5 minutes
      const ts = parseInt(svixTimestamp, 10)
      const now = Math.floor(Date.now() / 1000)
      if (Math.abs(now - ts) > 300) return false

      // Decode secret (strip "whsec_" prefix then base64-decode)
      const secretBytes = Buffer.from(
        secret.startsWith('whsec_') ? secret.slice(6) : secret,
        'base64'
      )

      // Signed content: "{svix-id}.{svix-timestamp}.{body}"
      const toSign = `${svixId}.${svixTimestamp}.${rawBody}`

      const computed = createHmac('sha256', secretBytes)
        .update(toSign, 'utf8')
        .digest('base64')

      // svix-signature may contain multiple "v1,<sig>" separated by spaces
      const signatures = signatureHeader.split(' ')
      return signatures.some((s) => {
        const sig = s.startsWith('v1,') ? s.slice(3) : s
        return sig === computed
      })
    } catch {
      return false
    }
  }

  // ── Fallback: plain HMAC-SHA256 (x-ycloud-signature: sha256=<hex>) ──
  if (!signatureHeader) return false

  const expected = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')

  const received = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader

  return expected === received
}
