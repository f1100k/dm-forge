# 0007. Transactional email provider: Resend

**Status:** accepted
**Date:** 2026-05-31
**Deciders:** Felipe Pestelato
**Supersedes:** —

## Context

Authentication and account flows must send transactional email: address
verification at sign-up (FR-003), password reset (FR-006), email-change
confirmation, and data-export download links. These are not satisfiable without
a real outbound email path. The Spec ("Autenticação e Conta") flags the
provider as an open decision ("Provedor de e-mail transacional — decisão
pendente") and the Tech Design defers it to this ADR (§11), recommending
**Resend** with **Postmark** and **AWS SES** as the alternatives to weigh.

Forces:

- **Deliverability.** Verification/reset email landing in spam blocks sign-up
  and account recovery — a direct hit to SC-001. The provider must handle
  SPF/DKIM/DMARC, IP reputation, and bounces for us.
- **Single point of failure.** The provider is a SPOF for verification and
  reset (Tech Design §8). Mitigation must include a documented SLA and a way to
  swap providers without rewrites.
- **Lazy infrastructure (Constitution principle 7).** A new external
  dependency is a permanent tax; it needs an ADR and must stay swappable. We do
  not want to operate our own mail server.
- **MVP stage.** A 2–3 dev greenfield project wants a free tier and a simple
  integration over enterprise knobs.

## Decision

**Transactional email is sent through Resend.** The integration is isolated
behind the existing `EmailSender` interface (`apps/api/src/email/`), so the
provider is swappable by adding an adapter and flipping one env var.

- The concrete adapter (`resend-email-sender.ts`) implements `EmailSender` and
  is selected at boot by `EMAIL_PROVIDER`. `EMAIL_PROVIDER=noop` keeps the
  no-op sender for dev/test/offline; `EMAIL_PROVIDER=resend` activates the real
  provider in staging/production.
- Configuration is via env (ADR 0005): `EMAIL_PROVIDER`, `RESEND_API_KEY`,
  `EMAIL_FROM`. When `EMAIL_PROVIDER=resend`, the API key and from-address are
  required and validated loudly at boot.
- Provider errors are **wrapped and redacted** before they reach a log: the
  adapter throws an `EmailProviderError` carrying only a provider-supplied
  error name, never the API key, recipient, or token (SC-005,
  `docs/resilience-observability.md`). Callers translate that rejection into
  the user-facing `EMAIL_PROVIDER_DOWN` (503) error.

## Consequences

- **Positive:** Deliverability, DKIM, and bounce handling are the provider's
  problem, not ours. Simple HTTP API (`resend.emails.send`) with a clear
  `{ data, error }` contract that fails loudly in CI. Free tier
  (~3k emails/month) covers the MVP at zero cost. No mail server to operate
  (honours principle 7).
- **Negative:** A new external runtime dependency and a SPOF for auth email.
  Vendor lock-in risk is bounded by the `EmailSender` seam but not zero
  (templates and the send call live in the adapter). Free-tier limits
  (100/day) would need a paid plan as the user base grows.
- **Neutral:** `resend` is a single-consumer dependency (only `apps/api` sends
  email) so it stays local in `apps/api/package.json`, not the pnpm catalog.
  Email body/subject copy is rendered in the adapter for the two supported
  locales (pt-BR, en); a richer templating story can come later behind the same
  seam.

## Alternatives considered

- **AWS SES** — cheapest at scale and battle-tested, but heavier to start:
  IAM setup, domain verification, and a sandbox-removal request before any real
  send. Operational overhead outweighs the cost advantage at MVP volume.
- **Postmark** — excellent transactional deliverability and templating, but no
  free tier (trial only) and pricier than Resend's free tier for the MVP. Kept
  as the first fallback if Resend deliverability disappoints.
- **Self-hosted SMTP (e.g. Nodemailer + Postfix).** SMTP is only a transport;
  we would still own IP reputation, SPF/DKIM/DMARC, warm-up, and bounce
  handling. For auth-critical email this is a high-risk SPOF with no SLA that
  we operate ourselves — rejected under principle 7. Nodemailer pointed at a
  managed relay is just another provider behind more plumbing. The
  `EmailSender` seam keeps this option open later if ever needed.

## References

- Constitution principle(s) affected: 7 (lazy infrastructure — new external
  dependency, gated and isolated), 8 (every complexity has permanent cost).
- Tech Design / Spec that triggered: Tech Design - Autenticação e Conta (§3.3,
  §8, §11, §12); Spec - Autenticação e Conta (§8, SC-001, SC-005). Execution
  Plan item F5.
- ADR 0005 (environment configuration and runtime validation); ADR 0003
  (Better Auth strategy — the hooks that call this provider).
- External material: Resend (https://resend.com/docs/send-with-nodejs).
