import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE } from './resolve-locale.js'
import { applyUserLocale, i18n, resources } from './index.js'

afterEach(async () => {
  // Keep tests order-independent: restore the default language after any switch.
  await i18n.changeLanguage(DEFAULT_LOCALE)
})

describe('i18n resources', () => {
  it('ships a common namespace for both supported locales', () => {
    // Arrange / Act / Assert
    expect(resources['pt-BR'].common).toBeDefined()
    expect(resources.en.common).toBeDefined()
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

    // Assert
    expect(['pt-BR', 'en']).toContain(i18n.resolvedLanguage)
  })
})
