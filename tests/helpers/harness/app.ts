import { createApp } from '@dm-forge/api/server'

// Re-export the Hono app factory so tests do `app.request(...)` against the
// real route tree (CORS + Better Auth + tRPC) without binding a port. Hono's
// fetch-shaped adapter handles the request in-process.
//
//   const app = createApp()
//   const res = await app.request('/health')
//
export { createApp }
