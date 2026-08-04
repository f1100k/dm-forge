import { getEnv } from '../env.js'
import { createEmailSender } from './create-email-sender.js'
import type { EmailSender } from './email-sender.js'

const env = getEnv()

// The transactional sender the whole API shares, resolved once at boot from
// EMAIL_PROVIDER (noop offline, Resend in staging/prod — F4/F5, ADR 0007).
// A module-level instance rather than one per call site: the Better Auth hooks
// and the account flows must not be able to drift onto different providers.
export const emailSender: EmailSender = createEmailSender({
  provider: env.EMAIL_PROVIDER,
  resendApiKey: env.RESEND_API_KEY,
  from: env.EMAIL_FROM,
})
