import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '../harness/msw-server.js'

// MSW lifecycle for the integration:web project. Tests can call server.use()
// inline to override handlers per case; afterEach resets to the defaults.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
