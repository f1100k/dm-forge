import { describe, expect, it } from 'vitest'
import { EmailMessageSchema } from './email-sender.js'

describe('EmailMessageSchema', () => {
  it('accepts an email_verification message', () => {
    // Arrange
    const message = {
      kind: 'email_verification',
      to: 'gm@example.com',
      locale: 'pt-BR',
      verificationUrl: 'https://app.dmforge.test/verify-email?token=abc123',
    }

    // Act
    const result = EmailMessageSchema.safeParse(message)

    // Assert
    expect(result.success).toBe(true)
  })

  it('accepts a password_reset message', () => {
    // Arrange
    const message = {
      kind: 'password_reset',
      to: 'gm@example.com',
      locale: 'en',
      resetUrl: 'https://app.dmforge.test/reset-password/abc123',
    }

    // Act
    const result = EmailMessageSchema.safeParse(message)

    // Assert
    expect(result.success).toBe(true)
  })

  it('normalizes the recipient address to trimmed lowercase', () => {
    // Arrange
    const message = {
      kind: 'email_verification',
      to: '  GM@Example.COM  ',
      locale: 'pt-BR',
      verificationUrl: 'https://app.dmforge.test/verify-email?token=abc123',
    }

    // Act
    const result = EmailMessageSchema.parse(message)

    // Assert
    expect(result.to).toBe('gm@example.com')
  })

  it('rejects an unknown kind', () => {
    // Arrange
    const message = {
      kind: 'welcome',
      to: 'gm@example.com',
      locale: 'pt-BR',
    }

    // Act
    const result = EmailMessageSchema.safeParse(message)

    // Assert
    expect(result.success).toBe(false)
  })

  it('rejects a malformed recipient address', () => {
    // Arrange
    const message = {
      kind: 'email_verification',
      to: 'not-an-email',
      locale: 'pt-BR',
      verificationUrl: 'https://app.dmforge.test/verify-email?token=abc123',
    }

    // Act
    const result = EmailMessageSchema.safeParse(message)

    // Assert
    expect(result.success).toBe(false)
  })

  it('rejects a non-absolute verification URL', () => {
    // Arrange
    const message = {
      kind: 'email_verification',
      to: 'gm@example.com',
      locale: 'pt-BR',
      verificationUrl: '/verify-email?token=abc123',
    }

    // Act
    const result = EmailMessageSchema.safeParse(message)

    // Assert
    expect(result.success).toBe(false)
  })

  it('rejects an unsupported locale', () => {
    // Arrange
    const message = {
      kind: 'password_reset',
      to: 'gm@example.com',
      locale: 'fr',
      resetUrl: 'https://app.dmforge.test/reset-password/abc123',
    }

    // Act
    const result = EmailMessageSchema.safeParse(message)

    // Assert
    expect(result.success).toBe(false)
  })
})
