// Node-only entry point for `@dm-forge/shared`. Anything that depends on Node
// APIs (fs, path, dotenv, etc.) lives here so the main barrel stays safe to
// import from browser code (apps/web).
export { loadEnv, type LoadEnvOptions } from './env/load-env.js'
