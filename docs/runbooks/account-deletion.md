# Runbook — account deletion and the monthly audit

Operator procedure for the right-to-erasure flow (Spec FR-010 / Story 5
cenário 2, SC-004). The policy behind it is ADR 0009; the code is
`apps/api/src/account/`.

Read this before answering a restore request or filing the monthly report.

## What the system does on its own

| When | What happens | Where |
|---|---|---|
| The user confirms deletion | `accountStatus = 'pending_deletion'`, `pendingDeletionAt = now`, every session row deleted, notice emailed | `account/deletion.ts` |
| Any sign-in attempt while pending | No session is created, on any path; the password path answers with the `ACCOUNT_PENDING_DELETION` code | `auth/better-auth.ts`, `account/account-status.ts` |
| Daily, 03:15 UTC | Accounts past 30 days are hard-deleted (cascading to sessions, accounts, verifications, consents, exports); an `AccountDeletionAudit` row is written; expired exports are emptied; spent login counters are dropped | `account/scheduler.ts` → `account/maintenance.ts` |

Nothing here needs an operator on the happy path. The two things that do are
below.

## Restoring an account (inside the 30-day window)

The account holder cannot restore their own account — that is deliberate
(ADR 0009: whoever can reach the button is whoever can reach delete). Requests
arrive as a reply to the deletion email.

1. **Confirm the request came from the holder.** Reply-to must match the
   account's address. If the request arrives from anywhere else, stop — the
   pending state may be the *result* of the takeover you are being asked to
   undo.
2. **Find the account id.** From the support mailbox thread, or:
   ```sql
   SELECT id, "pendingDeletionAt" FROM "user" WHERE email = $1;
   ```
3. **Check the window is still open.** `pendingDeletionAt + 30 days` must be in
   the future. Past that, the data is gone or about to be — the endpoint will
   refuse with `RESTORE_WINDOW_CLOSED`, and there is nothing to recover.
4. **Call the support endpoint** with the shared key (`SUPPORT_API_KEY`; never
   paste it into a ticket, a chat, or a shell history file you keep):
   ```bash
   curl -X POST "$API_URL/api/internal/account/$USER_ID/restore" \
     -H "x-support-api-key: $SUPPORT_API_KEY"
   ```
   - `200 {"ok":true}` — restored; the holder can sign in again immediately.
   - `409 NOT_PENDING` — the account is not scheduled for deletion. Nothing to
     do; check you have the right id.
   - `409 RESTORE_WINDOW_CLOSED` — too late (see step 3).
   - `401` — the key is wrong, or none is configured on that environment.
5. **Reply to the holder** confirming the account is back, and note the restore
   in the ticket. `account.deletion.restored` also lands in the API logs with
   the user id.

## Monthly audit (SC-004)

Run in the first days of each month, against production.

1. **Produce the report** for the month that just ended:
   ```bash
   pnpm --filter @dm-forge/api audit:deletions          # last whole month
   pnpm --filter @dm-forge/api audit:deletions 2026-05  # a specific month
   ```
   The command prints JSON and exits non-zero when anything is overdue.

2. **Read the three numbers.**
   - `purged` — accounts erased inside the window. This is the evidence
     SC-004 asks for.
   - `pendingCount` — accounts currently inside their 30 days. Expected to be
     non-zero; it is a queue, not a problem.
   - `overdue` — **must be zero.** Anything else means an account outlived its
     window and FR-010 is being violated right now.

3. **If `overdue` is not zero**, the daily job is not running or is failing:
   - Check the API logs for `account.maintenance.ran` (once a day) and
     `account.maintenance.failed`.
   - If the job never ran, the API process was down at 03:15 UTC or the
     scheduler was not started. Restarting the API is enough: selection is by
     absolute timestamp, so the next tick erases everything overdue at once.
   - To clear the backlog immediately without waiting for 03:15, restart the
     API and run the audit again after the next tick, or trigger
     `runAccountMaintenance(new Date())` from a maintenance shell.
   - Record the incident and the recovery date alongside the report.

4. **File the report** (the JSON output) with the month's compliance records.
   Keep it: it is the artefact that answers "prove the erasures happened".

## Notes and gotchas

- **Audit rows name nobody.** `AccountDeletionAudit.userIdHash` is
  `sha256(IP_HASH_SALT || userId)` — you cannot go from an audit row back to a
  person, by design. Reconcile counts, not identities.
- **Rotating `IP_HASH_SALT` breaks that join.** Digests written before a
  rotation will not match ones written after. If the salt is rotated, note the
  date in the compliance records so a future reader knows why the series has a
  seam.
- **Data exports expire on their own.** The same daily job blanks the payload
  and the download token of any export past its 7 days. A user asking why their
  link stopped working is seeing FR-009 working, not a bug — they can request a
  new export.
- **Deletion cascades, it does not soft-delete.** Once the job runs there is
  nothing left to restore, in the database or anywhere else. Everything a
  support restore can do happens before D+30.
