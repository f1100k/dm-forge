import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

let loaded = false

export type LoadEnvOptions = {
  // Explicit path to the `.env`. If omitted, walks up from cwd until it
  // finds the first `.env` in the tree.
  path?: string
  // Allow re-loading (useful in tests). Default: idempotent.
  force?: boolean
  // When true, values from `.env` overwrite variables already present in
  // process.env. Default false (12-factor: system env wins over the file).
  override?: boolean
}

// Reads the project's `.env` and applies variable expansion (${OTHER_VAR})
// before populating process.env. Must be called ONCE on process boot, before
// any read of process.env (see apps/api/src/load-env.ts).
export function loadEnv(options: LoadEnvOptions = {}): void {
  if (loaded && !options.force) return
  const envPath = options.path ?? findEnvFile(process.cwd())
  if (envPath) {
    const result = config({ path: envPath, quiet: true, override: options.override })
    expand(result)
  }
  loaded = true
}

function findEnvFile(start: string): string | undefined {
  let dir = start
  while (true) {
    const candidate = resolve(dir, '.env')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}
