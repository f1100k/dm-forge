import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The `.env` lives at the monorepo root — Vite by default only looks at cwd.
  envDir: '../..',
  resolve: {
    // Mirrors the `paths` entry in tsconfig.json: shadcn/ui components import
    // each other through `@/`, so the bundler has to resolve it as well. The two
    // vitest projects that render apps/web declare the same alias.
    alias: {
      '@': resolve(here, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
