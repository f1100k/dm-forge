import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './msw-server.js'

// Boot the MSW server for the whole apps/web integration project. Tests
// can call server.use(...) inline to override handlers per case.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
