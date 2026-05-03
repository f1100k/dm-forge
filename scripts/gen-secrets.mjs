#!/usr/bin/env node
// Generates BETTER_AUTH_SECRET (48 bytes, base64) and ENCRYPTION_KEY
// (32 bytes, base64) and writes them to the monorepo root `.env`.
//
// Behavior:
//  - if the key already has a value, do NOT overwrite (rotation invalidates
//    sessions / breaks existing AiConnections — a serious mistake to make
//    by accident).
//  - pass `--force` to overwrite (deliberate use, dev only).
//  - creates the line if it is entirely missing from the file.

import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(here, '..', '.env')
const force = process.argv.includes('--force')

if (!existsSync(envPath)) {
  console.error(`error: ${envPath} does not exist. Run \`cp .env.example .env\` first.`)
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
    body += `${body.endsWith('\n') ? '' : '\n'}${name}=${generated}\n`
    decisions.push({ name, action: 'created' })
    continue
  }

  const current = match[1].trim()
  if (current && !force) {
    decisions.push({ name, action: 'kept (already has a value; use --force to rotate)' })
    continue
  }

  body = body.replace(re, `${name}=${generated}`)
  decisions.push({ name, action: current ? 'rotated (--force)' : 'filled' })
}

writeFileSync(envPath, body, 'utf8')

for (const { name, action } of decisions) {
  console.log(`${name}: ${action}`)
}
