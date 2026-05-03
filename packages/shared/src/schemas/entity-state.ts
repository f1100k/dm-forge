import { z } from 'zod'

// Mirrors Prisma's `EntityState` enum. Kept here so the frontend and the
// tRPC contracts can reference the type without importing from @dm-forge/db.
export const EntityStateSchema = z.enum(['ACTIVE', 'DELETED'])
export type EntityState = z.infer<typeof EntityStateSchema>
