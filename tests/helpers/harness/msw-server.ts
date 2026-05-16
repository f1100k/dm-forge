import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// Default MSW handlers — endpoints the apps/web bootstrap path always hits.
// Individual tests layer overrides with server.use(http.post('/trpc/...')).
const defaultHandlers = [
  http.get('http://localhost:3000/trpc/auth.me', () =>
    HttpResponse.json({ result: { data: null } }),
  ),
  http.get('http://localhost:3000/trpc/bootstrap.healthcheck', () =>
    HttpResponse.json({ result: { data: { ok: true, timestamp: new Date().toISOString() } } }),
  ),
  // Better Auth session endpoint — null until a test signs in.
  http.get('http://localhost:3000/api/auth/get-session', () => HttpResponse.json(null)),
]

export const server = setupServer(...defaultHandlers)
