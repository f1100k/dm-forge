import type common from '../locales/pt-BR/common.json'

// Type-safe translation keys: t('nav.home') is checked against the pt-BR catalog
// shape (the canonical source — en must mirror it).
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: { common: typeof common }
    returnNull: false
  }
}
