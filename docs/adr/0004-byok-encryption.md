# 0004. BYOK encryption with AES-256-GCM

**Status:** accepted
**Date:** 2026-05-02
**Deciders:** Founding team
**Supersedes:** —

## Context

Users supply their own LLM provider keys (`docs/architecture-overview.md` → BYOK). These keys are sensitive — they are billing credentials. We need them encrypted at rest, decrypted only inside the request that uses them, and never leaked through logs or error messages.

## Decision

- **AES-256-GCM** is the only allowed cipher for BYOK keys. Implementation lives in `packages/ai/src/crypto/encryption.ts`. No alternative cipher; no roll-your-own.
- **Master key** is a 32-byte (256-bit) value loaded from `ENCRYPTION_KEY` (base64-encoded). Generated via `openssl rand -base64 32`.
- **IV (nonce)** is 12 bytes, randomly generated per encryption. Stored alongside the ciphertext in the `AiConnection.iv` column.
- **Authentication tag** (16 bytes, GCM default) is stored in `AiConnection.authTag`. Tampering fails decryption.
- **Storage shape.** `AiConnection` carries `encryptedKey`, `iv`, `authTag` as `Bytes`. Plaintext is never persisted in any column or log.
- **In-memory only.** Decrypt on every use — never cache the plaintext key in process memory across requests, never echo it back to the client after creation.
- **Master key rotation** is a future ADR. For now, rotation requires re-encrypting all `AiConnection` rows with the new key (offline migration script).

## Consequences

- **Positive:** AEAD (GCM) gives integrity and confidentiality in one primitive; Node's built-in `crypto` module — no extra dependency; tampering surfaces as a decrypt error, not silent data corruption.
- **Negative:** losing `ENCRYPTION_KEY` means every stored BYOK is unrecoverable (acceptable — keys are user-supplied and replaceable).
- **Neutral:** introduces a strict env-var contract: missing or short `ENCRYPTION_KEY` causes the API to refuse to boot.

## Alternatives considered

- **AES-256-CBC + HMAC** — strictly weaker UX for the same security guarantee. Two primitives where one (GCM) suffices.
- **Hosted KMS (AWS, GCP, Vault)** — overkill for the current scale and would gate local dev on cloud credentials. Reconsider when we cross the threshold where the tradeoff flips.
- **Plaintext + DB encryption-at-rest** — Postgres encryption-at-rest protects against disk theft, not against a leaked DB dump. BYOK keys deserve application-level encryption.

## References

- Constitution principles: 7 (lazy infrastructure — no KMS yet), 8 (every complexity has permanent cost).
- `docs/architecture-overview.md` — BYOK.
- `docs/resilience-observability.md` — logging policy (BYOK keys never logged).
