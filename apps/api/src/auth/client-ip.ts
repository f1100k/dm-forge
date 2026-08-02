// Best-effort client IP for the sign-in rate limiter. The API sits behind a
// reverse proxy in every deployed environment, so the socket address is the
// proxy's — the forwarded headers are what identify the caller.
//
// The value is only ever used as one half of a salted hash (see
// `hashIpEmail`), never logged or persisted in the clear. A spoofed
// `X-Forwarded-For` therefore buys an attacker nothing beyond a fresh counter
// bucket, which is the same thing a new IP would buy them.
const FORWARDED_HEADERS = ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'] as const

// Used when no forwarded header is present (local dev, in-process tests). All
// such callers share one bucket, which is the safe direction to err.
export const UNKNOWN_CLIENT_IP = 'unknown'

export function resolveClientIp(headers: Headers): string {
  for (const header of FORWARDED_HEADERS) {
    const value = headers.get(header)
    if (!value) continue
    // X-Forwarded-For is a chain; the left-most entry is the original client.
    const first = value.split(',')[0]?.trim()
    if (first) return first
  }
  return UNKNOWN_CLIENT_IP
}
