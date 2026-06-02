import { type Locale, LocaleSchema } from '@dm-forge/shared'

// Default UI language. Mirrors User.locale @default("pt-BR") in the Prisma
// schema (Tech Design §4.1) so server and client agree on the baseline.
export const DEFAULT_LOCALE: Locale = 'pt-BR'

// The locales shipped with a catalog, derived from the shared LocaleSchema so
// the supported set never drifts from the source of truth.
export const SUPPORTED_LOCALES: readonly Locale[] = LocaleSchema.options

/**
 * Resolve the UI locale following the order defined in Tech Design §3.2:
 * (1) the authenticated user's stored locale, (2) the browser Accept-Language
 * chain, (3) the default (pt-BR). Always returns a supported Locale — never an
 * unsupported tag — so an "incorrect fallback" is structurally impossible.
 */
export function resolveLocale(input: {
  userLocale?: string | null
  acceptLanguages?: readonly string[]
}): Locale {
  const stored = LocaleSchema.safeParse(input.userLocale)
  if (stored.success) return stored.data

  for (const tag of input.acceptLanguages ?? []) {
    const matched = matchSupported(tag)
    if (matched) return matched
  }

  return DEFAULT_LOCALE
}

// Map a BCP-47 language tag to a supported Locale by its primary subtag
// (e.g. "en-US" → "en", "pt-PT" → "pt-BR"), or null when unsupported.
function matchSupported(tag: string): Locale | null {
  const normalized = tag.trim().toLowerCase()
  if (normalized === 'pt' || normalized.startsWith('pt-')) return 'pt-BR'
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en'
  return null
}
