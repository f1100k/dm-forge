import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE } from './resolve-locale.js'
import { applyUserLocale, i18n, resources } from './index.js'

afterEach(async () => {
  // Keep tests order-independent: restore the default language after any switch.
  await i18n.changeLanguage(DEFAULT_LOCALE)
})

// Collect every leaf key as a dotted path so two catalogs can be compared for
// structural parity regardless of nesting (e.g. "nav.signIn").
function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value !== null && typeof value === 'object'
      ? collectKeys(value as Record<string, unknown>, path)
      : [path]
  })
}

describe('i18n resources', () => {
  it('ships a common namespace for both supported locales', () => {
    // Arrange / Act / Assert
    expect(resources['pt-BR'].common).toBeDefined()
    expect(resources.en.common).toBeDefined()
  })

  it('keeps key parity between the en and pt-BR catalogs', () => {
    // TypeScript only types call sites against pt-BR, so a missing en key
    // compiles clean and silently falls back at runtime. Enforce parity here.
    const ptKeys = collectKeys(resources['pt-BR'].common).sort()
    const enKeys = collectKeys(resources.en.common).sort()

    expect(enKeys).toEqual(ptKeys)
  })

  it('translates a key in pt-BR', () => {
    // Arrange
    const t = i18n.getFixedT('pt-BR', 'common')

    // Act
    const value = t('nav.signIn')

    // Assert
    expect(value).toBe('Entrar')
  })

  it('translates the same key in en', () => {
    // Arrange
    const t = i18n.getFixedT('en', 'common')

    // Act
    const value = t('nav.signIn')

    // Assert
    expect(value).toBe('Sign in')
  })
})

describe('applyUserLocale', () => {
  it('switches the active language to a valid user locale', async () => {
    // Arrange / Act
    await applyUserLocale('en')

    // Assert
    expect(i18n.resolvedLanguage).toBe('en')
  })

  it('does not fall to an unsupported language when the user locale is invalid', async () => {
    // Arrange
    await i18n.changeLanguage('en')

    // Act
    await applyUserLocale('es')

    // Assert: an invalid user locale must not move the active language.
    expect(i18n.resolvedLanguage).toBe('en')
  })
})
