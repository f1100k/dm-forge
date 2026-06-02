import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en/common.json'
import ptBR from '../locales/pt-BR/common.json'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, resolveLocale } from './resolve-locale.js'

export const defaultNS = 'common'

export const resources = {
  'pt-BR': { common: ptBR },
  en: { common: en },
} as const

// Inline resources keep init synchronous (Constitution principle 6: determinism
// over a network-loaded catalog — no http backend, no Suspense). LanguageDetector
// covers the Accept-Language step and fallbackLng covers the default; the
// authenticated user's locale takes priority and is applied after the session
// hydrates via applyUserLocale (Tech Design §3.2 resolution order).
void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    // React escapes interpolated values already.
    interpolation: { escapeValue: false },
    // Only the browser language; never persist to storage (locale lives on the
    // user record, not localStorage).
    detection: { order: ['navigator'], caches: [] },
    react: { useSuspense: false },
    returnNull: false,
  })

/**
 * Switch the active language to the one resolved from the user's stored locale,
 * honouring the Tech Design §3.2 order. Call once the session hydrates
 * (account.me); it is also the seam the profile language toggle (S3.2) drives
 * via i18n.changeLanguage.
 */
export async function applyUserLocale(userLocale: string | null | undefined): Promise<void> {
  const target = resolveLocale({ userLocale, acceptLanguages: i18next.languages })
  if (i18next.resolvedLanguage !== target) {
    await i18next.changeLanguage(target)
  }
}

export { i18next as i18n }
