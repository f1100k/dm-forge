#!/usr/bin/env node
// Gera BETTER_AUTH_SECRET (48 bytes, base64) e ENCRYPTION_KEY (32 bytes,
// base64) e grava no .env da raiz do monorepo.
//
// Comportamento:
//  - se a chave já tem valor, NÃO sobrescreve (rotação invalida sessões / quebra
//    AiConnections existentes — erro grave de fazer por acidente).
//  - passe `--force` para sobrescrever (uso consciente, dev só).
//  - cria a linha caso esteja totalmente ausente do arquivo.

import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(here, '..', '.env')
const force = process.argv.includes('--force')

if (!existsSync(envPath)) {
  console.error(`erro: ${envPath} não existe. Rode \`cp .env.example .env\` primeiro.`)
  process.exit(1)
}

const KEYS = [
  { name: 'BETTER_AUTH_SECRET', bytes: 48 },
  { name: 'ENCRYPTION_KEY', bytes: 32 },
]

let body = readFileSync(envPath, 'utf8')
const decisions = []

for (const { name, bytes } of KEYS) {
  const generated = randomBytes(bytes).toString('base64')
  const re = new RegExp(`^${name}=(.*)$`, 'm')
  const match = body.match(re)

  if (!match) {
    body += (body.endsWith('\n') ? '' : '\n') + `${name}=${generated}\n`
    decisions.push({ name, action: 'criada' })
    continue
  }

  const current = match[1].trim()
  if (current && !force) {
    decisions.push({ name, action: 'mantida (já tem valor; use --force para rotacionar)' })
    continue
  }

  body = body.replace(re, `${name}=${generated}`)
  decisions.push({ name, action: current ? 'rotacionada (--force)' : 'preenchida' })
}

writeFileSync(envPath, body, 'utf8')

for (const { name, action } of decisions) {
  console.log(`${name}: ${action}`)
}
