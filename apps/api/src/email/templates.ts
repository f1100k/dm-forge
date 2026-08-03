import type { Locale } from '@dm-forge/shared'
import type { EmailMessage } from './email-sender.js'

// Subject + HTML body a concrete sender hands to the provider.
export interface RenderedEmail {
  subject: string
  html: string
}

// Renders the localized subject and body for a transactional message. Copy is
// kept inline for the two supported locales (LocaleSchema: pt-BR, en): the
// server sends only a handful of fixed templates, so a full i18n runtime here
// would be premature infrastructure (Constitution principle 7). The frontend
// i18n setup (card F6) is a separate concern with its own catalogs.
export function renderEmail(message: EmailMessage): RenderedEmail {
  switch (message.kind) {
    case 'email_verification':
      return verificationEmail(message.locale, message.verificationUrl)
    case 'password_reset':
      return passwordResetEmail(message.locale, message.resetUrl)
    case 'email_change':
      return emailChangeEmail(message.locale, message.verificationUrl, message.previousEmail)
  }
}

function verificationEmail(locale: Locale, url: string): RenderedEmail {
  if (locale === 'pt-BR') {
    return {
      subject: 'Confirme seu e-mail — DM Forge',
      html: layout(
        'Confirme seu e-mail',
        'Para ativar sua conta no DM Forge, confirme seu endereço de e-mail.',
        'Confirmar e-mail',
        url,
        'O link expira em 24 horas. Se você não criou esta conta, ignore este e-mail.',
      ),
    }
  }
  return {
    subject: 'Confirm your email — DM Forge',
    html: layout(
      'Confirm your email',
      'To activate your DM Forge account, confirm your email address.',
      'Confirm email',
      url,
      'This link expires in 24 hours. If you did not create this account, ignore this email.',
    ),
  }
}

function passwordResetEmail(locale: Locale, url: string): RenderedEmail {
  if (locale === 'pt-BR') {
    return {
      subject: 'Redefina sua senha — DM Forge',
      html: layout(
        'Redefina sua senha',
        'Recebemos um pedido para redefinir a senha da sua conta no DM Forge.',
        'Redefinir senha',
        url,
        'O link expira em 1 hora. Se você não fez este pedido, ignore este e-mail.',
      ),
    }
  }
  return {
    subject: 'Reset your password — DM Forge',
    html: layout(
      'Reset your password',
      'We received a request to reset the password for your DM Forge account.',
      'Reset password',
      url,
      'This link expires in 1 hour. If you did not request this, ignore this email.',
    ),
  }
}

// Confirms a pending email change on the address that is taking over (card
// US3, Spec Story 3 cenário 3). Naming the address being replaced lets the
// recipient tell a change they asked for from one they did not; `previousEmail`
// is validated by EmailSchema, whose grammar excludes the characters that
// would break out of the surrounding markup.
function emailChangeEmail(locale: Locale, url: string, previousEmail: string): RenderedEmail {
  if (locale === 'pt-BR') {
    return {
      subject: 'Confirme seu novo e-mail — DM Forge',
      html: layout(
        'Confirme seu novo e-mail',
        `Recebemos um pedido para trocar o e-mail da conta ${previousEmail} para este endereço. A conta só passa a usar este e-mail depois da confirmação.`,
        'Confirmar novo e-mail',
        url,
        'O link expira em 24 horas. Se você não fez este pedido, ignore este e-mail — nada muda na conta.',
      ),
    }
  }
  return {
    subject: 'Confirm your new email — DM Forge',
    html: layout(
      'Confirm your new email',
      `We received a request to move the account ${previousEmail} to this address. The account keeps its current email until you confirm.`,
      'Confirm new email',
      url,
      'This link expires in 24 hours. If you did not request this, ignore this email — nothing changes on the account.',
    ),
  }
}

// Minimal, dependency-free HTML shell. `url` is an absolute URL validated by
// EmailMessageSchema (z.string().url()) and produced by Better Auth, so it is
// safe to place in the href; the surrounding copy is static.
function layout(heading: string, intro: string, cta: string, url: string, footer: string): string {
  return [
    `<h1>${heading}</h1>`,
    `<p>${intro}</p>`,
    `<p><a href="${url}">${cta}</a></p>`,
    `<p>${footer}</p>`,
  ].join('')
}
