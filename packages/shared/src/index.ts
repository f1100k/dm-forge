// Browser-safe barrel: nothing here may import Node APIs. Node-only APIs
// (loadEnv, etc.) live in `@dm-forge/shared/node` (`./node.ts`).

export {
  type AcceptedVersions,
  type LegalDocumentType,
  outdatedLegalDocuments,
  PRIVACY_VERSION,
  requiresTermsReAcceptance,
  TERMS_VERSION,
} from './auth/constants.js'
export {
  type ConsentAction,
  ConsentActionSchema,
  type ConsentType,
  ConsentTypeSchema,
  type DeletionConfirmation,
  DeletionConfirmationSchema,
  DisplayNameSchema,
  EmailSchema,
  type ListConsentsInput,
  ListConsentsInputSchema,
  type Locale,
  LocaleSchema,
  PasswordSchema,
  type RecordConsentInput,
  RecordConsentInputSchema,
  type RequestDeletionInput,
  RequestDeletionInputSchema,
  type SignUpInput,
  SignUpInputSchema,
  type UpdateProfileInput,
  UpdateProfileInputSchema,
} from './auth/schemas.js'
export { parseEnv } from './env/parse-env.js'
export {
  type AppError,
  type AppErrorCode,
  AppErrorCodeSchema,
} from './errors/app-error.js'
export { createId, isCuid } from './ids/ids.js'
export {
  type LegalDocument,
  legalDocument,
  type LegalDocumentSection,
  legalDocumentVersion,
} from './legal/documents.js'
export { type EntityState, EntityStateSchema } from './schemas/entity-state.js'
export {
  ACCOUNT_TELEMETRY_EVENTS,
  type AccountTelemetryEvent,
  createConsoleTelemetrySink,
  createTelemetry,
  type Telemetry,
  type TelemetryConsent,
  type TelemetryDetails,
  type TelemetryEvent,
  type TelemetrySink,
} from './telemetry/telemetry.js'
