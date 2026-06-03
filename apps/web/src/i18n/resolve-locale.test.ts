import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, resolveLocale } from './resolve-locale.js'

describe('resolveLocale', () => {
  it('prefers a valid authenticated user locale over everything else', () => {
    // Arrange
    const input = { userLocale: 'en', acceptLanguages: ['pt-BR'] }

    // Act
    const locale = resolveLocale(input)

    // Assert
    expect(locale).toBe('en')
  })

  it('accepts pt-BR as a stored user locale', () => {
    // Arrange / Act
    const locale = resolveLocale({ userLocale: 'pt-BR', acceptLanguages: ['en-US'] })

    // Assert
    expect(locale).toBe('pt-BR')
  })

  it('ignores an unsupported user locale and falls through to Accept-Language', () => {
    // Arrange
    const input = { userLocale: 'es', acceptLanguages: ['en-US', 'en'] }

    // Act
    const locale = resolveLocale(input)

    // Assert
    expect(locale).toBe('en')
  })

  it('matches an Accept-Language tag by its primary subtag', () => {
    // Arrange / Act
    const locale = resolveLocale({ acceptLanguages: ['fr-FR', 'en-GB'] })

    // Assert
    expect(locale).toBe('en')
  })

  it('maps any Portuguese region tag to pt-BR', () => {
    // Arrange / Act
    const locale = resolveLocale({ acceptLanguages: ['pt-PT'] })

    // Assert
    expect(locale).toBe('pt-BR')
  })

  it('falls back to the default when no source matches', () => {
    // Arrange / Act
    const locale = resolveLocale({ userLocale: null, acceptLanguages: ['es', 'de'] })

    // Assert
    expect(locale).toBe(DEFAULT_LOCALE)
  })

  it('falls back to the default when given no signals at all', () => {
    // Arrange / Act
    const locale = resolveLocale({})

    // Assert
    expect(locale).toBe('pt-BR')
  })

  it('only ever returns a supported locale', () => {
    // Arrange / Act
    const locale = resolveLocale({ userLocale: 'zz', acceptLanguages: ['zz-ZZ'] })

    // Assert
    expect(SUPPORTED_LOCALES).toContain(locale)
  })
})
