import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // O .env fica no root do monorepo — Vite por padrão olha apenas no cwd.
  envDir: '../..',
  server: {
    port: 5173,
    strictPort: true,
  },
})
