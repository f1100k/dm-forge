// Automatic secret scrubbing for structured logs (Spec NFR-003, Tech Design §10.1).
//
// NFR-003 promises that auth logs never carry a plaintext password, a session
// token or a reset token — "scrubbing automático". That promise cannot rest on
// every call site remembering, because the leak that matters is the accidental
// one: a provider error echoed into a catch block, a URL captured with its
// `?token=` still attached, a request body spread into a log line. So the scrub
// runs on the way out, over whatever the caller passed.
//
// Two rules, because either alone is wrong:
//   - by key, so a field *named* like a secret never prints what it holds, no
//     matter what shape the value takes;
//   - by value, so a secret sitting inside free text is caught even when the
//     field around it looks innocent.
//
// And one exemption: fields that already hold a one-way digest stay legible.
// They are the correlation keys the audit and brute-force trails are read by
// (Tech Design §4.4/§4.5), and a hash is not the secret it was derived from —
// redacting them would cost the operator the signal while protecting nothing.

export const REDACTED = '[REDACTED]'

// A field whose name says it holds a credential. Matched as a substring so
// `newPassword`, `sessionToken` and `resetToken` are all covered without an
// exhaustive list. `api[_-]?key` is anchored to that exact word so it does not
// swallow every field ending in "Key" — `ipEmailKey` is a digest, not a key.
const SENSITIVE_KEY =
  /password|passwd|pwd|secret|token|credential|authorization|cookie|api[_-]?key|byok/i

// A field whose value is already one-way. `downloadTokenHash` matches
// SENSITIVE_KEY on "token" and would otherwise be redacted; the digest rule
// wins, which is what keeps the export receipts readable.
const DIGEST_KEY_SUFFIX = /(?:hash|hashed|digest|fingerprint|prefix)$/i

// `ipEmailKey` is the salted SHA-256 the sign-in counter is keyed by. Its name
// ends in "Key" rather than "Hash", so it needs naming outright (Tech Design §4.4).
const DIGEST_KEY_NAMES = new Set(['ipemailkey'])

// Guards against a payload that would otherwise take the logger down with it.
// A log line is never worth a stack overflow.
const MAX_DEPTH = 8

type Replacement = readonly [RegExp, (match: string, ...groups: string[]) => string]

const mask = () => REDACTED

// Ordered: the broadest, most structured shapes first, so a `Bearer eyJ…` is
// masked whole instead of being half-eaten by the JWT rule.
const VALUE_PATTERNS: readonly Replacement[] = [
  // `Authorization: Bearer <token>` — the header verbatim, as it arrives in a
  // captured request or a provider error.
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, () => `Bearer ${REDACTED}`],

  // Credentials embedded in a connection or callback URL. Prisma puts the whole
  // DATABASE_URL into some of its error messages, password included — the
  // classic way a secret reaches a log nobody thought was sensitive.
  [
    /\b([a-z][a-z0-9+.-]*:\/\/)([^:@\s/]+):([^@\s/]+)@/gi,
    (_match, scheme, user) => `${scheme}${user}:${REDACTED}@`,
  ],

  // `token=…`, `"password": "…"`, `api_key=…` — the shape a reset link, a
  // cookie header or a serialised body arrives in when it lands inside a
  // string. Runs before the token-shape rules below so a `token=<jwt>` is
  // consumed whole, rather than being masked twice into a mangled line.
  [
    /\b([A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|token|credential|api[_-]?key))(s?"?\s*[=:]\s*"?)([^\s"'&;,}\]]+)/gi,
    (_match, key, separator) => `${key}${separator}${REDACTED}`,
  ],

  // JWTs — three base64url segments. Better Auth's session and verification
  // tokens surface in this shape (named explicitly in Tech Design §10.1).
  [/\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]+/g, mask],

  // Provider key formats this product actually handles: OpenRouter/OpenAI BYOK
  // keys, Resend API keys, GitHub tokens, Google OAuth client secrets.
  [/\bsk-(?:or-v1-)?[A-Za-z0-9_-]{16,}/g, mask],
  [/\bre_[A-Za-z0-9_-]{16,}/g, mask],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, mask],
  [/\bGOCSPX-[A-Za-z0-9_-]{10,}/g, mask],

  // Long hex runs: reset and verification tokens, raw key material, digests.
  // The floor is 32 so a 24-character cuid2 entity id never trips it — the ids
  // are what make a log line traceable and they are not secrets.
  [/\b[0-9a-fA-F]{32,}\b/g, mask],
]

function isDigestKey(key: string): boolean {
  return DIGEST_KEY_SUFFIX.test(key) || DIGEST_KEY_NAMES.has(key.toLowerCase())
}

function isSensitiveKey(key: string): boolean {
  return !isDigestKey(key) && SENSITIVE_KEY.test(key)
}

// Masks every secret shape known to appear in free text. Exported because the
// message of an error is the most common place one hides, and callers that
// build a string before handing it over should be able to reach the same rules.
export function scrubText(value: string): string {
  let scrubbed = value
  for (const [pattern, replacement] of VALUE_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, replacement)
  }
  return scrubbed
}

// Deep-scrubs an arbitrary log payload, returning a copy safe to serialise.
// Pure: the caller's object is never mutated, so a scrubbed log line can never
// change the data the request is still working with.
export function scrubLogValue(value: unknown): unknown {
  return scrub(value, undefined, 0, new WeakSet())
}

function scrub(
  value: unknown,
  key: string | undefined,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (key !== undefined && isSensitiveKey(key)) return REDACTED
  if (depth > MAX_DEPTH) return '[Truncated]'

  if (typeof value === 'string') {
    // A digest field is left exactly as it is: the value regexes would treat a
    // 64-character SHA-256 as a token and redact the very thing the line exists
    // to correlate on.
    return key !== undefined && isDigestKey(key) ? value : scrubText(value)
  }

  if (value === null || typeof value !== 'object') return value

  // A cycle is a caller mistake, not a reason to lose the line.
  if (seen.has(value)) return '[Circular]'
  seen.add(value)

  if (value instanceof Error) {
    return { name: value.name, message: scrubText(value.message) }
  }
  if (value instanceof Date) return value.toISOString()

  if (Array.isArray(value)) {
    // Elements inherit the field name they arrived under, so `tokens: [...]`
    // redacts every entry rather than only the field itself.
    return value.map((entry) => scrub(entry, key, depth + 1, seen))
  }

  const result: Record<string, unknown> = {}
  for (const [entryKey, entryValue] of Object.entries(value)) {
    result[entryKey] = scrub(entryValue, entryKey, depth + 1, seen)
  }
  return result
}
