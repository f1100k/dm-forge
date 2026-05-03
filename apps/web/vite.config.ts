import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // The `.env` lives at the monorepo root — Vite by default only looks at cwd.
  envDir: '../..',
  server: {
    port: 5173,
    strictPort: true,
  },
})
