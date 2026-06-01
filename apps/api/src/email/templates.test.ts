import { describe, expect, it } from 'vitest'
import type { EmailMessage } from './email-sender.js'
import { renderEmail } from './templates.js'

const verifyUrl = 'https://app.dmforge.test/verify-email?token=abc123'
const resetUrl = 'https://app.dmforge.test/reset-password/abc123'

function verification(locale: EmailMessage['locale']): EmailMessage {
  return { kind: 'email_verification', to: 'gm@example.com', locale, verificationUrl: verifyUrl }
}

function reset(locale: EmailMessage['locale']): EmailMessage {
  return { kind: 'password_reset', to: 'gm@example.com', locale, resetUrl }
}

describe('renderEmail', () => {
  it('renders the pt-BR verification subject and links the verification URL', () => {
    // Act
    const rendered = renderEmail(verification('pt-BR'))

    // Assert
    expect(rendered.subject).toBe('Confirme seu e-mail — DM Forge')
    expect(rendered.html).toContain(`href="${verifyUrl}"`)
  })

  it('renders the en verification subject', () => {
    // Act
    const rendered = renderEmail(verification('en'))

    // Assert
    expect(rendered.subject).toBe('Confirm your email — DM Forge')
  })

  it('renders the pt-BR password-reset subject and links the reset URL', () => {
    // Act
    const rendered = renderEmail(reset('pt-BR'))

    // Assert
    expect(rendered.subject).toBe('Redefina sua senha — DM Forge')
    expect(rendered.html).toContain(`href="${resetUrl}"`)
  })

  it('renders the en password-reset subject', () => {
    // Act
    const rendered = renderEmail(reset('en'))

    // Assert
    expect(rendered.subject).toBe('Reset your password — DM Forge')
  })
})
