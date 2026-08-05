// Terms of Use — English text. DRAFT: written from what the Spec already
// states about the product, pending legal review. `draft: true` makes the
// screen say so to whoever is reading it.
//
// When publishing a revision: bump TERMS_VERSION, the `version` field below,
// and describe the change in `changes` — that is the summary the re-acceptance
// dialog shows.

import { TERMS_VERSION } from '../auth/constants.js'
import type { LegalDocument } from './documents.js'

export const TERMS_EN: LegalDocument = {
  title: 'DM Forge Terms of Use',
  version: TERMS_VERSION,
  draft: true,
  changes: [
    'First published version of these Terms, in force since 1 January 2026.',
    'AI providers used with your own key (BYOK): the key is yours, the cost is yours, and we never use it for anything beyond the requests you make.',
    'Account closure with a 30-day window to change your mind before permanent deletion.',
  ],
  sections: [
    {
      heading: '1. What DM Forge is',
      paragraphs: [
        'DM Forge is a tool for tabletop RPG game masters: a structured codex for campaigns, NPCs, story arcs and sessions, with an AI assistant that works on the material you created yourself.',
        'These Terms govern your use of the platform. By creating an account you agree to them. If you do not agree, do not use the service.',
      ],
    },
    {
      heading: '2. Account and eligibility',
      paragraphs: [
        'To create an account you declare that you are 13 or older. Where your local law requires a higher age to consent to the processing of personal data, that age applies instead.',
        'You are responsible for keeping your credentials confidential and for everything that happens in your account. Tell us as soon as you suspect unauthorised access.',
      ],
    },
    {
      heading: '3. Acceptable use',
      paragraphs: [
        'Use DM Forge to create and organise narrative material. Do not use it to publish unlawful content, infringe third-party rights, attempt unauthorised access to accounts or infrastructure, or deliberately overload the service.',
        'We may suspend accounts that break these rules, with notice whenever giving notice is possible.',
      ],
    },
    {
      heading: '4. Your content stays yours',
      paragraphs: [
        'Campaigns, NPCs, notes and any other material you create remain yours. You grant us only the technical licence needed to store, display and process that content in order to run the service for you.',
        'You can export everything at any time, in an open format, from the Privacy screen.',
      ],
    },
    {
      heading: '5. Artificial intelligence with your own key (BYOK)',
      paragraphs: [
        'AI features run on your own provider key. When you use them, campaign content is sent to the provider you chose, and your relationship with that provider — cost, limits and policies — is between you and them.',
        'We do not use your content to train models, and we do not share it with AI providers outside the requests you trigger yourself.',
      ],
    },
    {
      heading: '6. Availability and changes to the service',
      paragraphs: [
        'We work to keep the service available, but it is provided "as is", with no guarantee of uninterrupted operation. Maintenance, incidents and technical limits may interrupt access.',
        'We may change, add or discontinue features. Significant changes affecting your use will be announced with reasonable notice.',
      ],
    },
    {
      heading: '7. Closing your account',
      paragraphs: [
        'You can delete your account at any time. The account enters a pending-deletion state for 30 days, during which support can reverse the decision. After that period the data is permanently erased.',
        'We may close accounts that break these Terms or applicable law.',
      ],
    },
    {
      heading: '8. Limitation of liability',
      paragraphs: [
        'To the fullest extent permitted by law, we are not liable for indirect damages, lost profits or data loss arising from use of the service. Nothing here limits rights that consumer law grants you and that cannot be waived.',
      ],
    },
    {
      heading: '9. Changes to these Terms',
      paragraphs: [
        'When we publish a new version we will show you what changed and ask for a fresh acceptance before you continue using the platform. Until you accept, use is blocked — and you can sign out and decide later.',
      ],
    },
    {
      heading: '10. Governing law and contact',
      paragraphs: [
        'These Terms are governed by the laws of the Federative Republic of Brazil, with the consumer’s domicile as the forum for consumer relations.',
        'Questions about these Terms: suporte@dmforge.io.',
      ],
    },
  ],
}
