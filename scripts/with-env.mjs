#!/usr/bin/env node
// Wrapper that loads the monorepo-root `.env` with expansion (dotenv +
// dotenv-expand) and then delegates to the command passed as arguments.
// Used by the `db:*` scripts and any other CLI tool that does not support
// expansion natively (Prisma, tsx, etc.). Runtime apps load via
// @dm-forge/shared/node#loadEnv directly at boot.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const envPath = resolve(repoRoot, '.env')

if (existsSync(envPath)) {
  expand(config({ path: envPath, quiet: true }))
}

const [, , cmd, ...args] = process.argv
if (!cmd) {
  console.error('usage: node scripts/with-env.mjs <command> [args...]')
  process.exit(64)
}

const child = spawn(cmd, args, { stdio: 'inherit', env: process.env, shell: false })
child.on('error', (err) => {
  console.error(`failed to execute "${cmd}":`, err.message)
  process.exit(127)
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
