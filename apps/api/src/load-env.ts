import { loadEnv } from '@dm-forge/shared/node'

// Side-effect import: loads `.env` (with ${...} expansion) BEFORE any read of
// process.env. Must be the first import of the entrypoint.
loadEnv()
