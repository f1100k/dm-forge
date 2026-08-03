import { describe, expect, it } from 'vitest'
import { resolveClientIp, UNKNOWN_CLIENT_IP } from './client-ip.js'

describe('resolveClientIp', () => {
  it('takes the left-most entry of the forwarded chain', () => {
    // Arrange — client, then two proxies.
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 198.51.100.1, 10.0.0.2' })

    // Act / Assert
    expect(resolveClientIp(headers)).toBe('203.0.113.7')
  })

  it('trims surrounding whitespace', () => {
    expect(resolveClientIp(new Headers({ 'x-forwarded-for': '  203.0.113.7 ' }))).toBe(
      '203.0.113.7',
    )
  })

  it('falls back to x-real-ip when no forwarded chain is present', () => {
    expect(resolveClientIp(new Headers({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9')
  })

  it('falls back to cf-connecting-ip last', () => {
    expect(resolveClientIp(new Headers({ 'cf-connecting-ip': '203.0.113.11' }))).toBe(
      '203.0.113.11',
    )
  })

  it('prefers the forwarded chain over the single-value headers', () => {
    // Arrange
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.7',
      'x-real-ip': '198.51.100.1',
    })

    // Act / Assert
    expect(resolveClientIp(headers)).toBe('203.0.113.7')
  })

  it('reports a known placeholder when no header identifies the caller', () => {
    // Assert — local dev and in-process tests share one bucket rather than
    // silently disabling the limiter.
    expect(resolveClientIp(new Headers())).toBe(UNKNOWN_CLIENT_IP)
  })

  it('skips an empty header instead of returning a blank identity', () => {
    // Arrange
    const headers = new Headers({ 'x-forwarded-for': '', 'x-real-ip': '203.0.113.9' })

    // Act / Assert
    expect(resolveClientIp(headers)).toBe('203.0.113.9')
  })
})
