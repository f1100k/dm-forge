import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EmailMessage } from './email-sender.js'
import { createNoopEmailSender } from './noop-email-sender.js'

const verificationMessage: EmailMessage = {
  kind: 'email_verification',
  to: 'gm@example.com',
  locale: 'pt-BR',
  verificationUrl: 'https://app.dmforge.test/verify-email?token=secret-token',
}

const resetMessage: EmailMessage = {
  kind: 'password_reset',
  to: 'gm@example.com',
  locale: 'en',
  resetUrl: 'https://app.dmforge.test/reset-password/secret-token',
}

describe('createNoopEmailSender', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves without throwing for a verification message', async () => {
    // Arrange
    const sender = createNoopEmailSender(() => {})

    // Act
    const result = sender.send(verificationMessage)

    // Assert
    await expect(result).resolves.toBeUndefined()
  })

  it('resolves without throwing for a password-reset message', async () => {
    // Arrange
    const sender = createNoopEmailSender(() => {})

    // Act
    const result = sender.send(resetMessage)

    // Assert
    await expect(result).resolves.toBeUndefined()
  })

  it('hands the full message to an injected observer', async () => {
    // Arrange
    const observed: EmailMessage[] = []
    const sender = createNoopEmailSender((message) => observed.push(message))

    // Act
    await sender.send(verificationMessage)

    // Assert
    expect(observed).toEqual([verificationMessage])
  })

  it('logs the kind only, never the token or recipient, by default', async () => {
    // Arrange
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const sender = createNoopEmailSender()

    // Act
    await sender.send(verificationMessage)

    // Assert
    const logged = info.mock.calls.flat().join(' ')
    expect(logged).toContain('email_verification')
    expect(logged).not.toContain('secret-token')
    expect(logged).not.toContain(verificationMessage.to)
  })
})
