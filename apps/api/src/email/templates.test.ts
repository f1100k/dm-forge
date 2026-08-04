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

function emailChange(locale: EmailMessage['locale']): EmailMessage {
  return {
    kind: 'email_change',
    to: 'new@example.com',
    locale,
    previousEmail: 'gm@example.com',
    verificationUrl: verifyUrl,
  }
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

  it('renders the pt-BR email-change subject and links the verification URL', () => {
    // Act
    const rendered = renderEmail(emailChange('pt-BR'))

    // Assert
    expect(rendered.subject).toBe('Confirme seu novo e-mail — DM Forge')
    expect(rendered.html).toContain(`href="${verifyUrl}"`)
  })

  it('renders the en email-change subject', () => {
    // Act
    const rendered = renderEmail(emailChange('en'))

    // Assert
    expect(rendered.subject).toBe('Confirm your new email — DM Forge')
  })

  it('names the address being replaced so the recipient can spot a change they did not ask for', () => {
    // Act
    const rendered = renderEmail(emailChange('pt-BR'))

    // Assert
    expect(rendered.html).toContain('gm@example.com')
  })
})

const downloadUrl = 'https://api.dmforge.test/api/account/data-export/exp_1/download?token=abc123'

function dataExport(locale: EmailMessage['locale']): EmailMessage {
  return {
    kind: 'data_export_ready',
    to: 'gm@example.com',
    locale,
    downloadUrl,
    expiresAt: '2026-05-23T12:00:00.000Z',
  }
}

function deletionRequested(locale: EmailMessage['locale']): EmailMessage {
  return {
    kind: 'account_deletion_requested',
    to: 'gm@example.com',
    locale,
    deletionDueAt: '2026-06-15T12:00:00.000Z',
  }
}

describe('renderEmail — data export ready', () => {
  it('renders the pt-BR subject and links the download URL', () => {
    // Act
    const rendered = renderEmail(dataExport('pt-BR'))

    // Assert
    expect(rendered.subject).toBe('Seus dados estão prontos para download — DM Forge')
    expect(rendered.html).toContain(`href="${downloadUrl}"`)
  })

  it('renders the en subject', () => {
    // Act
    const rendered = renderEmail(dataExport('en'))

    // Assert
    expect(rendered.subject).toBe('Your data export is ready — DM Forge')
  })

  it('tells the recipient when the link stops working', () => {
    // Act — Spec FR-009: the link is valid for 7 days, and the mail is the
    // only place a user who closed the app learns the deadline.
    const rendered = renderEmail(dataExport('pt-BR'))

    // Assert
    expect(rendered.html).toContain('23 de maio de 2026')
  })
})

describe('renderEmail — account deletion requested', () => {
  it('renders the pt-BR subject', () => {
    // Act
    const rendered = renderEmail(deletionRequested('pt-BR'))

    // Assert
    expect(rendered.subject).toBe('Sua conta será excluída — DM Forge')
  })

  it('renders the en subject', () => {
    // Act
    const rendered = renderEmail(deletionRequested('en'))

    // Assert
    expect(rendered.subject).toBe('Your account is scheduled for deletion — DM Forge')
  })

  it('names the date the data is erased', () => {
    // Act — the notice exists so an unrequested deletion is noticeable while
    // there is still time to reverse it (Spec FR-010).
    const rendered = renderEmail(deletionRequested('en'))

    // Assert
    expect(rendered.html).toContain('June 15, 2026')
  })

  it('offers no link, because restoring runs through support', () => {
    // Act
    const rendered = renderEmail(deletionRequested('pt-BR'))

    // Assert — a button that leads nowhere would be worse than none.
    expect(rendered.html).not.toContain('<a ')
  })
})
