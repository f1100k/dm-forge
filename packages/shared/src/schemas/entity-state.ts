import { z } from 'zod'

// Espelha o enum `EntityState` do Prisma. Mantemos aqui para que o frontend
// e os contratos tRPC referenciem o tipo sem importar de @dm-forge/db.
export const EntityStateSchema = z.enum(['ACTIVE', 'DELETED'])
export type EntityState = z.infer<typeof EntityStateSchema>
