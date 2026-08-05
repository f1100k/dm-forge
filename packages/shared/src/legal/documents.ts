// The published text of the legal documents, next to the versions they are
// published under (auth/constants.ts). Bumping TERMS_VERSION without bringing
// the text along would put the re-acceptance gate in front of a document the
// user cannot read, so version and text live in the same folder and move in the
// same PR.
//
// The text is data, not markdown: the re-acceptance dialog scrolls it inside a
// panel styled with the app's own typography, and a runtime markdown renderer
// would be a dependency bought for one screen (Constitution: simplicity).

import { PRIVACY_VERSION, TERMS_VERSION } from '../auth/constants.js'
import type { LegalDocumentType } from '../auth/constants.js'
import type { Locale } from '../auth/schemas.js'
import { PRIVACY_EN } from './privacy-en.js'
import { PRIVACY_PT_BR } from './privacy-pt-br.js'
import { TERMS_EN } from './terms-en.js'
import { TERMS_PT_BR } from './terms-pt-br.js'

export type LegalDocumentSection = {
  heading: string
  paragraphs: string[]
}

export type LegalDocument = {
  /** The document's own title, as it appears at the top of the text. */
  title: string
  /** The version this text is published under — always the in-force constant. */
  version: string
  /** Set while the text still awaits legal review; the UI says so on screen. */
  draft: boolean
  /** What this version brings, one line each — the "what changed" summary. */
  changes: string[]
  sections: LegalDocumentSection[]
}

const DOCUMENTS: Record<LegalDocumentType, Record<Locale, LegalDocument>> = {
  TERMS: { 'pt-BR': TERMS_PT_BR, en: TERMS_EN },
  PRIVACY: { 'pt-BR': PRIVACY_PT_BR, en: PRIVACY_EN },
}

const VERSIONS: Record<LegalDocumentType, string> = {
  TERMS: TERMS_VERSION,
  PRIVACY: PRIVACY_VERSION,
}

/** The in-force version of a document, from the same constants account.me uses. */
export function legalDocumentVersion(type: LegalDocumentType): string {
  return VERSIONS[type]
}

/**
 * The text to put in front of the user for a document, in their language.
 * Every supported locale has a translation, so this never falls back.
 */
export function legalDocument(type: LegalDocumentType, locale: Locale): LegalDocument {
  return DOCUMENTS[type][locale]
}
