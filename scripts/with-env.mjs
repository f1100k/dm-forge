#!/usr/bin/env node
// Wrapper que carrega o `.env` da raiz do monorepo com expansão (dotenv +
// dotenv-expand) e então delega para o comando passado como argumento. Usado
// pelos scripts `db:*` e qualquer outra ferramenta CLI que não suporte
// expansão nativamente (Prisma, tsx, etc.). Apps em runtime carregam via
// @dm-forge/shared#loadEnv direto no boot.

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
  console.error('uso: node scripts/with-env.mjs <comando> [args...]')
  process.exit(64)
}

const child = spawn(cmd, args, { stdio: 'inherit', env: process.env, shell: false })
child.on('error', (err) => {
  console.error(`falha ao executar "${cmd}":`, err.message)
  process.exit(127)
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
