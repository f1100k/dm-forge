import { createId as cuid2, isCuid as isCuid2 } from '@paralleldrive/cuid2'

// Project-wide ID generator. Always use this helper instead of calling cuid2
// directly — that way any future change (length, prefix) happens in a single
// place (Constitution principle 4 + docs/coding-patterns.md).
//
// Lives in @dm-forge/shared because both apps/web (client-generated IDs) and
// apps/api/packages/* need it, and apps/web is forbidden from importing
// packages/db.
export function createId(): string {
  return cuid2()
}

export function isCuid(value: string): boolean {
  return isCuid2(value)
}
