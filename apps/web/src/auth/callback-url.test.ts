import { describe, expect, it } from 'vitest'
import { appCallbackUrl } from './callback-url.js'

describe('appCallbackUrl', () => {
  it('builds an absolute URL on the web origin, not the API origin', () => {
    // Arrange
    const origin = 'http://localhost:5173'

    // Act
    const url = appCallbackUrl('/', origin)

    // Assert
    expect(url).toBe('http://localhost:5173/')
  })

  it('resolves a nested path against the origin', () => {
    // Arrange / Act
    const url = appCallbackUrl('/campaigns', 'http://localhost:5173')

    // Assert
    expect(url).toBe('http://localhost:5173/campaigns')
  })

  it('defaults to the app root', () => {
    // Arrange / Act
    const url = appCallbackUrl(undefined, 'https://app.dmforge.test')

    // Assert
    expect(url).toBe('https://app.dmforge.test/')
  })

  it('never returns a relative URL — the value Better Auth redirects to verbatim', () => {
    // Arrange / Act
    const url = appCallbackUrl('/', 'https://app.dmforge.test')

    // Assert
    expect(url.startsWith('https://')).toBe(true)
  })

  it('falls back to the browser origin when none is given', () => {
    // Arrange / Act
    const url = appCallbackUrl()

    // Assert
    expect(url).toBe(`${window.location.origin}/`)
  })
})
