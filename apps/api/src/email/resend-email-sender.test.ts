import { describe, expect, it } from 'vitest'
import type { EmailMessage } from './email-sender.js'
import {
  EmailProviderError,
  type ResendEmailClient,
  createResendEmailSender,
} from './resend-email-sender.js'

const FROM = 'DM Forge <no-reply@dmforge.app>'

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

type SentPayload = { from: string; to: string; subject: string; html: string }

function recordingClient(): { client: ResendEmailClient; sent: SentPayload[] } {
  const sent: SentPayload[] = []
  const client: ResendEmailClient = {
    emails: {
      send(payload) {
        sent.push(payload)
        return Promise.resolve({ data: { id: 'email_1' }, error: null })
      },
    },
  }
  return { client, sent }
}

function erroringClient(error: { name?: string; message?: string }): ResendEmailClient {
  return { emails: { send: () => Promise.resolve({ data: null, error }) } }
}

function throwingClient(cause: unknown): ResendEmailClient {
  return { emails: { send: () => Promise.reject(cause) } }
}

describe('createResendEmailSender', () => {
  it('sends the rendered message to the provider from the configured address', async () => {
    // Arrange
    const { client, sent } = recordingClient()
    const sender = createResendEmailSender({ from: FROM, client })

    // Act
    await sender.send(verificationMessage)

    // Assert
    expect(sent).toHaveLength(1)
    expect(sent[0]?.from).toBe(FROM)
    expect(sent[0]?.to).toBe('gm@example.com')
    expect(sent[0]?.subject).toContain('Confirme seu e-mail')
    expect(sent[0]?.html).toContain(verificationMessage.verificationUrl)
  })

  it('renders subject and body in the message locale', async () => {
    // Arrange
    const { client, sent } = recordingClient()
    const sender = createResendEmailSender({ from: FROM, client })

    // Act
    await sender.send(resetMessage)

    // Assert
    expect(sent[0]?.subject).toBe('Reset your password — DM Forge')
    expect(sent[0]?.html).toContain(resetMessage.resetUrl)
  })

  it('resolves without throwing on a successful send', async () => {
    // Arrange
    const { client } = recordingClient()
    const sender = createResendEmailSender({ from: FROM, client })

    // Act
    const result = sender.send(verificationMessage)

    // Assert
    await expect(result).resolves.toBeUndefined()
  })

  it('throws EmailProviderError exposing only the provider error name', async () => {
    // Arrange
    const sender = createResendEmailSender({
      from: FROM,
      client: erroringClient({ name: 'rate_limit_exceeded', message: 'too many requests' }),
    })

    // Act
    let caught: unknown
    try {
      await sender.send(verificationMessage)
    } catch (error) {
      caught = error
    }

    // Assert
    expect(caught).toBeInstanceOf(EmailProviderError)
    if (caught instanceof Error) {
      expect(caught.message).toContain('rate_limit_exceeded')
      // No personal data or secret token leaks into the thrown error (SC-005).
      expect(caught.message).not.toContain('secret-token')
      expect(caught.message).not.toContain(verificationMessage.to)
    }
  })

  it('wraps a transport failure without leaking the underlying cause', async () => {
    // Arrange — the cause carries a secret to prove it is never surfaced.
    const sender = createResendEmailSender({
      from: FROM,
      client: throwingClient(new Error('connect ECONNREFUSED key=re_supersecret')),
    })

    // Act
    let caught: unknown
    try {
      await sender.send(resetMessage)
    } catch (error) {
      caught = error
    }

    // Assert
    expect(caught).toBeInstanceOf(EmailProviderError)
    if (caught instanceof Error) {
      expect(caught.message).toBe('email provider rejected send: transport_error')
      expect(caught.message).not.toContain('re_supersecret')
    }
  })
})
