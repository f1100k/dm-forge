// Browser-safe barrel: nothing here may import Node APIs. Node-only APIs
// (loadEnv, etc.) live in `@dm-forge/shared/node` (`./node.ts`).

export {
  type AcceptedVersions,
  PRIVACY_VERSION,
  requiresTermsReAcceptance,
  TERMS_VERSION,
} from './auth/constants.js'
export {
  type ConsentType,
  ConsentTypeSchema,
  EmailSchema,
  type Locale,
  LocaleSchema,
  PasswordSchema,
} from './auth/schemas.js'
export {
  type EmailKind,
  type EmailMessage,
  EmailMessageSchema,
  type EmailSender,
} from './email/email-sender.js'
export {
  createNoopEmailSender,
  type NoopEmailObserver,
} from './email/noop-email-sender.js'
export { parseEnv } from './env/parse-env.js'
export {
  type AppError,
  type AppErrorCode,
  AppErrorCodeSchema,
} from './errors/app-error.js'
export { createId, isCuid } from './ids/ids.js'
export { type EntityState, EntityStateSchema } from './schemas/entity-state.js'
