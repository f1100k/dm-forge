// Privacy Policy — English text. DRAFT: written from what the Spec and Tech
// Design already define about data processing (LGPD), pending legal review.
// `draft: true` makes the screen say so to whoever is reading it.
//
// When publishing a revision: bump PRIVACY_VERSION, the `version` field below,
// and describe the change in `changes` — that is the summary the re-acceptance
// dialog shows.

import { PRIVACY_VERSION } from '../auth/constants.js'
import type { LegalDocument } from './documents.js'

export const PRIVACY_EN: LegalDocument = {
  title: 'DM Forge Privacy Policy',
  version: PRIVACY_VERSION,
  draft: true,
  changes: [
    'First published version of this Policy, in force since 1 January 2026.',
    'Telemetry is opt-in: it stays off until you turn it on, and withdrawal takes effect immediately.',
    'Full export of your data and account deletion with permanent erasure after 30 days, both available from the Privacy screen itself.',
  ],
  sections: [
    {
      heading: '1. Who processes your data',
      paragraphs: [
        'DM Forge is the controller of the personal data processed on the platform, under Brazilian Law 13.709/2018 (LGPD).',
        'To exercise your rights or ask about privacy, contact our data protection officer: privacidade@dmforge.io.',
      ],
    },
    {
      heading: '2. What data we process',
      paragraphs: [
        'Account data: display name, email, interface language, linked sign-in providers, and the history of your consents (what you accepted or withdrew, with version and date).',
        'Content you create: campaigns, NPCs, story arcs, sessions and notes.',
        'Minimal technical security data: sign-in attempt records and the associated IP addresses, used to detect abuse.',
      ],
    },
    {
      heading: '3. Why we process it (legal bases)',
      paragraphs: [
        'Performance of the contract (Art. 7, V): keeping your account, storing your content and delivering the platform’s features.',
        'Consent (Art. 7, I and Art. 8): acceptance of the legal documents and, separately, usage telemetry.',
        'Legitimate interest (Art. 7, IX): platform security, fraud and abuse prevention, always limited to what is necessary.',
        'Compliance with legal obligations (Art. 7, II): keeping records the law requires us to keep.',
      ],
    },
    {
      heading: '4. Telemetry',
      paragraphs: [
        'Telemetry is optional and ships turned off. If you turn it on, we collect usage events — screens opened, actions taken, errors — without the content of your campaigns.',
        'You can withdraw consent at any time from the Privacy screen; withdrawal applies from that moment on and is recorded in your consent history.',
      ],
    },
    {
      heading: '5. Who we share it with',
      paragraphs: [
        'Infrastructure and transactional email providers, strictly to run the service, under contract and bound by confidentiality.',
        'AI providers, only when you use AI features with your own key, and only the content of that request. We do not sell personal data.',
      ],
    },
    {
      heading: '6. Your rights',
      paragraphs: [
        'You may confirm that processing exists, access your data, correct it, request anonymisation or erasure, withdraw consents and request portability (LGPD Art. 18).',
        'Full export and account deletion are available directly from the Privacy screen, with no ticket to open. For anything else: privacidade@dmforge.io.',
      ],
    },
    {
      heading: '7. Retention and erasure',
      paragraphs: [
        'We keep your data for as long as the account exists. When you request deletion, the account enters pending deletion for 30 days — the window to reverse it — and the data is then permanently erased.',
        'Records the law obliges us to keep, such as access logs, are retained for the legal period, isolated from the rest.',
      ],
    },
    {
      heading: '8. Security',
      paragraphs: [
        'We apply technical and administrative measures to protect your data: encryption in transit, passwords stored only as hashes, access control and logging of sensitive operations.',
        'No system is immune to incidents. Should an incident with relevant risk occur, we will notify you and the Brazilian data protection authority as required by the LGPD.',
      ],
    },
    {
      heading: '9. International transfers',
      paragraphs: [
        'Part of our infrastructure and some AI providers may be located outside Brazil. In those cases the transfer takes place under the safeguards set out in the LGPD.',
      ],
    },
    {
      heading: '10. Changes to this Policy',
      paragraphs: [
        'When we publish a new version we will show what changed and ask for a fresh acceptance before you continue. You can always sign out and decide later.',
      ],
    },
  ],
}
