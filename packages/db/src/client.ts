import { PrismaClient } from './generated/client/index.js'

// Singleton para evitar múltiplas conexões em hot-reload (Vite/Turbopack).
declare global {
  // eslint-disable-next-line no-var
  var __dmForgePrisma: PrismaClient | undefined
}

export const prisma =
  globalThis.__dmForgePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__dmForgePrisma = prisma
}
