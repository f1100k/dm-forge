import { loadEnv } from '@dm-forge/shared/node'

loadEnv()

const { prisma } = await import('./client.js')

// Initial seed — empty until the first feature. The command exists so that
// `pnpm db:seed` is part of the contract from day 1.
async function main() {
  console.info(JSON.stringify({ level: 'info', msg: 'seed: nothing to populate yet' }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
