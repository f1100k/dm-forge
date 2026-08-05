import { describe, expect, it } from 'vitest'
import { PRIVACY_VERSION, TERMS_VERSION } from '../auth/constants.js'
import type { LegalDocumentType } from '../auth/constants.js'
import type { Locale } from '../auth/schemas.js'
import { legalDocument, legalDocumentVersion } from './documents.js'

const TYPES: LegalDocumentType[] = ['TERMS', 'PRIVACY']
const LOCALES: Locale[] = ['pt-BR', 'en']

describe('legalDocument', () => {
  it.each(TYPES.flatMap((type) => LOCALES.map((locale) => ({ type, locale }))))(
    'has readable text for $type in $locale',
    ({ type, locale }) => {
      // Act
      const document = legalDocument(type, locale)

      // Assert — the re-acceptance gate scrolls this text; an empty document
      // would put a blank panel in front of a blocking decision.
      expect(document.title.length).toBeGreaterThan(0)
      expect(document.sections.length).toBeGreaterThan(0)
      for (const section of document.sections) {
        expect(section.heading.length).toBeGreaterThan(0)
        expect(section.paragraphs.length).toBeGreaterThan(0)
      }
    },
  )

  it.each(TYPES.flatMap((type) => LOCALES.map((locale) => ({ type, locale }))))(
    'publishes $type in $locale under the in-force version',
    ({ type, locale }) => {
      // Act
      const document = legalDocument(type, locale)

      // Assert — text and version move together, or the gate asks someone to
      // accept a version whose text is not the one on screen.
      expect(document.version).toBe(legalDocumentVersion(type))
    },
  )

  it.each(TYPES)('summarises what version %s brings', (type) => {
    // Act
    const document = legalDocument(type, 'pt-BR')

    // Assert — the dialog's "what changed" block reads from here.
    expect(document.changes.length).toBeGreaterThan(0)
  })

  it('keeps the same section count across locales', () => {
    // Assert — a translation that drops a section would show a shorter
    // document to whoever reads it in that language.
    for (const type of TYPES) {
      expect(legalDocument(type, 'en').sections.length).toBe(
        legalDocument(type, 'pt-BR').sections.length,
      )
    }
  })

  it('reports the in-force versions from the shared constants', () => {
    // Assert
    expect(legalDocumentVersion('TERMS')).toBe(TERMS_VERSION)
    expect(legalDocumentVersion('PRIVACY')).toBe(PRIVACY_VERSION)
  })
})
