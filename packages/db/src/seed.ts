import { prisma } from './client.js'

// Seed inicial — vazio até a primeira feature. O comando existe para que
// `pnpm db:seed` faça parte do contrato desde o dia 1.
async function main() {
  console.info(JSON.stringify({ level: 'info', msg: 'seed: nada a popular ainda' }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
