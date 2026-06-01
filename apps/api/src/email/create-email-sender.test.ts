import { describe, expect, it } from 'vitest'
import { createEmailSender } from './create-email-sender.js'

describe('createEmailSender', () => {
  it('returns a working sender for the noop provider', async () => {
    // Arrange
    const sender = createEmailSender({ provider: 'noop' })

    // Act
    const result = sender.send({
      kind: 'email_verification',
      to: 'gm@example.com',
      locale: 'pt-BR',
      verificationUrl: 'https://app.dmforge.test/verify-email?token=abc',
    })

    // Assert
    await expect(result).resolves.toBeUndefined()
  })

  it('builds a sender for the resend provider when key and from are present', () => {
    // Act — construction must not reach the network.
    const sender = createEmailSender({
      provider: 'resend',
      resendApiKey: 're_test_key',
      from: 'DM Forge <no-reply@dmforge.app>',
    })

    // Assert
    expect(typeof sender.send).toBe('function')
  })

  it('throws when the resend provider is selected without an API key', () => {
    // Act / Assert
    expect(() =>
      createEmailSender({ provider: 'resend', from: 'DM Forge <no-reply@dmforge.app>' }),
    ).toThrow(/resendApiKey/)
  })

  it('throws when the resend provider is selected without a from address', () => {
    // Act / Assert
    expect(() => createEmailSender({ provider: 'resend', resendApiKey: 're_test_key' })).toThrow(
      /from/,
    )
  })
})
