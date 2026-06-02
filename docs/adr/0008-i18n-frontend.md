# 0008. Frontend internationalization with react-i18next

**Status:** accepted
**Date:** 2026-06-02
**Deciders:** Felipe Pestelato
**Supersedes:** —

## Context

The product targets Portuguese-speaking game masters but the PRD (§3.10) and
the "Autenticação e Conta" Spec require PT-BR **and** EN from the MVP: the user
profile stores a `locale` (FR-002, `User.locale @default("pt-BR")`), sign-up
derives the initial language from `Accept-Language` (Story 1), and the master
must be able to switch language and see the UI update after reload (SC-006,
Story 3 Cenário 2). None of this is possible without an i18n layer in
`apps/web`.

`engineering.md` (Stack) requires an ADR for any addition to the stack, and the
Tech Design (§3.2, §13) deferred the choice here, recommending
**react-i18next + i18next-browser-languagedetector**.

Forces:

- **Determinism (Constitution principle 6).** The catalog must load
  predictably with no flash of untranslated content. A network-loaded backend
  adds an async boundary (and Suspense) we do not need at MVP catalog size.
- **One source of truth for the locale.** The authoritative locale is the
  `User.locale` record, not browser storage. Language resolution must put the
  user record first; the browser language is only the pre-authentication guess.
- **Lazy infrastructure (principle 7) / permanent cost (principle 8).** A new
  frontend dependency is a permanent tax; it must earn its place and stay
  confined to `apps/web` (the frontend boundary in `modular-principles.md`).

## Decision

**Frontend i18n is provided by `react-i18next` on top of `i18next`, with
`i18next-browser-languagedetector` for the browser-language step.**

- **Supported locales:** `pt-BR` and `en`, derived from the shared
  `LocaleSchema` (`@dm-forge/shared`) so the UI set never drifts from the
  validation set. **Default / fallback:** `pt-BR`.
- **Catalogs** are JSON under `apps/web/src/locales/{pt-BR,en}/common.json`,
  namespace `common`, imported **inline** as static resources — init is
  synchronous, no http backend, no Suspense.
- **Language resolution order (Tech Design §3.2):** (1) the authenticated
  user's `locale`, (2) `Accept-Language` (via the detector), (3) default
  `pt-BR`. This order lives in one pure, tested function (`resolveLocale`); the
  user-locale step is applied after the session hydrates (`account.me`) and is
  the same seam the profile language toggle (S3.2) drives via
  `i18n.changeLanguage`.
- **Scope of this ADR/dependency:** confined to `apps/web`. The three packages
  (`i18next`, `react-i18next`, `i18next-browser-languagedetector`) are
  single-consumer and stay local in `apps/web/package.json`, not the pnpm
  catalog.

## Consequences

- **Positive:** Mature, well-typed i18n with `useTranslation`/`Trans`, type-safe
  keys via `CustomTypeOptions`, and a trivial language switch. Inline resources
  keep boot deterministic and tests synchronous.
- **Negative:** Two more runtime dependencies on the frontend. Catalogs are
  hand-kept in sync between `pt-BR` and `en` (the pt-BR catalog is the canonical
  shape that types the keys).
- **Neutral:** Locale persistence stays on the server (`User.locale` via
  `account.updateProfile`); the detector is configured with `caches: []` so the
  browser never becomes a competing source of truth.

## Alternatives considered

- **i18next with the http-backend (lazy-loaded catalogs).** Useful when catalogs
  are large or many; at MVP size it only adds an async load, a Suspense
  boundary, and a flash risk — rejected under principle 6.
- **react-intl (FormatJS).** Capable and ICU-message-first, but a heavier
  message-compilation workflow and no advantage over i18next for our two small
  catalogs. The Tech Design already recommended i18next.
- **Hand-rolled context + JSON maps.** Zero dependencies, but we would
  re-implement detection, fallback chains, interpolation, and plurals — more
  code to own for strictly less than a proven library (principle 8).

## References

- Constitution principle(s) affected: 6 (determinism), 7 (lazy infrastructure),
  8 (every complexity has permanent cost).
- Tech Design / Spec that triggered: Tech Design - Autenticação e Conta (§3.2,
  §4.1, §13). Spec - Autenticação e Conta (FR-002, SC-006, Story 1/Story 3).
  Execution Plan item F6. (The Tech Design names this ADR "0007"; that number
  was taken by the transactional-email ADR shipped in F5, so it lands here as
  0008.)
- `engineering.md` (Stack — additions require an ADR);
  `docs/modular-principles.md` (`apps/web` boundary).
- External material: react-i18next (https://react.i18next.com/),
  i18next-browser-languagedetector
  (https://github.com/i18next/i18next-browser-languageDetector).
