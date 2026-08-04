# 0009. Account deletion: 30-day window, in-process scheduler, hashed audit

**Status:** accepted
**Date:** 2026-08-03
**Deciders:** Felipe Pestelato
**Supersedes:** —

## Context

LGPD Art. 18 VI gives the account holder the right to have their personal data
erased. The Spec ("Autenticação e Conta", FR-010 / Story 5 cenário 2) turns that
into a concrete promise: a deletion request locks the account immediately, the
data is erased 30 days later, and support can restore the account inside that
window. SC-004 adds the evidence requirement — "100% resultam em apagamento
físico após 30 dias, comprovado por auditoria mensal".

The Tech Design defers the operational shape of this to an ADR (§11) because it
outlives the feature: whoever operates the product in a year inherits the
deletion policy, the job that enforces it, and the audit that proves it.

Forces:

- **Irreversibility.** Erasure is the one operation with no undo. A bug that
  fires it early is unrecoverable; a bug that never fires it is a standing legal
  violation. Both failure modes need to be observable.
- **Account takeover.** An attacker who reaches a live session could delete the
  account to cover their tracks. A grace period is what turns that from
  destruction into an inconvenience.
- **Lazy infrastructure (Constitution principle 7).** The obvious industry
  answer — a worker plus a queue, or a managed cron — is new infrastructure to
  run, monitor and pay for, and the workload is one query a day over a handful
  of rows.
- **Proof after the fact.** The audit has to show a request was carried out
  *after* the row it refers to is gone, which means keeping something — but
  keeping anything that identifies the person would defeat the erasure.

## Decision

**Deletion is a two-stage process, driven by an in-process daily job, and it
leaves a salted-digest audit trail.**

1. **Request (immediate).** `account.requestDeletion` verifies identity —
   password for a credential account, a fresh provider sign-in for an
   OAuth-only one — then sets `accountStatus = 'pending_deletion'`, stamps
   `pendingDeletionAt`, deletes every session row, and emails the holder the
   date their data disappears.
2. **Lock (30 days).** No session is created for a pending account, on any
   sign-in path: a Better Auth `session.create.before` hook refuses the insert.
   The password path additionally answers with the typed
   `ACCOUNT_PENDING_DELETION` code so the login screen can point at support.
   Restore is support-operated (`POST /api/internal/account/:id/restore`,
   authenticated by `SUPPORT_API_KEY`), not self-service — a button that undoes
   the lock would hand it back to whoever triggered it.
3. **Erasure (D+30).** A `node-cron` job inside the API process runs daily at
   03:15 UTC and hard-deletes every account past its window, cascading to
   sessions, accounts, verifications, consent records and data exports. Rows are
   claimed with `SELECT … FOR UPDATE SKIP LOCKED` inside the deleting
   transaction, so a second replica takes a different batch rather than the same
   one, and a crash mid-run leaves the account untouched and still due.
4. **Audit.** Each erasure writes an `AccountDeletionAudit` row holding
   `sha256(IP_HASH_SALT || userId)` and the timestamp — enough to count and
   reconcile, not enough to re-identify. The monthly reconciliation (SC-004) is
   `deletionAudit()` in `apps/api/src/account/deletion-audit.ts`, run through
   `pnpm --filter @dm-forge/api audit:deletions`; the operator procedure is
   `docs/runbooks/account-deletion.md`.

## Consequences

**Positive**

- The 30-day window makes the destructive path recoverable without giving the
  recovery to the attacker.
- No new infrastructure: the job is a library inside a process that already
  runs. Selection by absolute timestamp means a process that was down catches up
  on its next tick instead of losing a day of erasures.
- The audit answers "was it done?" without holding anything that says "for
  whom" — the digest is stable enough to reconcile against, and worthless on
  its own.
- Because every step is a plain function over the database, the whole policy is
  testable against a real Postgres (`tests/integration/api/account/`).

**Negative**

- The job runs on every API replica. `SKIP LOCKED` makes that safe rather than
  wrong, but it is coordination by database rather than by design; a genuinely
  multi-region deployment should revisit it.
- A process that stays down erases nothing, and nothing outside the process
  notices. The monthly audit's `overdue` count is the detector, which means
  detection is monthly — acceptable at MVP volume, not at scale.
- `IP_HASH_SALT` is reused as the application salt for the audit digest.
  Rotating it makes older audit rows unjoinable with newer ones; the runbook
  says so, and a rotation should be recorded alongside the reports.
- Restore depends on support acting inside 30 days. If nobody is reading the
  support mailbox, the window silently expires.

## Alternatives considered

- **Immediate hard delete on request.** Simplest, and it satisfies the letter of
  Art. 18 VI. Rejected: it makes account takeover permanently destructive and
  leaves an honest user who mis-clicked with nothing to appeal to.
- **Soft delete forever (never actually erase).** Rejected outright: it is the
  violation the right to erasure exists to prevent, and
  `docs/coding-patterns.md` reserves soft delete for campaign entities where
  retention has value.
- **External cron / worker / queue.** The conventional answer, and the correct
  one at a different scale. Rejected here under Constitution principle 7: one
  query a day over a handful of rows does not justify a second runtime to
  deploy, monitor and pay for. The migration path is a single function call
  (`runAccountMaintenance`) moving to a different trigger.
- **Keeping the raw `userId` in the audit trail.** Rejected: it would make the
  "erasure" retain the very identifier that links every other record to the
  person. The digest keeps reconciliation possible and re-identification out of
  reach.
- **Self-service restore in the UI.** Rejected for the MVP by the Spec, and the
  reasoning holds: whoever can reach the restore button is whoever can reach the
  delete button.

## References

- Spec — Autenticação e Conta (FR-010, Story 5 cenário 2, SC-004)
- Tech Design — Autenticação e Conta (§3.1 scheduler, §4.5 deletion policy,
  §6.5 deletion flow, §11 ADR, §12 complexity tracking)
- Constitution — principle 6 (determinism), principle 7 (lazy infrastructure)
- `docs/runbooks/account-deletion.md` — the operator procedure
- ADR 0005 (env and config) — `SUPPORT_API_KEY`, `IP_HASH_SALT`
- LGPD (Lei 13.709/2018) — Art. 16, Art. 18 VI
