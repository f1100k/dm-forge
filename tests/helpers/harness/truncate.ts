import type { PrismaClient } from '@dm-forge/db/client'

// Wipes every user table in the public schema. New tables added by future
// migrations are picked up automatically — no maintenance.
//
// Why information_schema and not Prisma model introspection: this works even
// when the test process has no generated client matching the latest schema,
// and we avoid coupling the helper to model names.
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '_prisma%'
  `
  if (rows.length === 0) return
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`)
}
