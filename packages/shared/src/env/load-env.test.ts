import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadEnv } from './load-env.js'

describe('loadEnv', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('expande variáveis referenciadas com ${...}', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dmforge-env-'))
    const envPath = join(dir, '.env')
    writeFileSync(
      envPath,
      [
        'POSTGRES_USER=dmforge',
        'POSTGRES_PASSWORD=secret',
        'POSTGRES_DB=dmforge',
        'DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}',
      ].join('\n'),
    )

    loadEnv({ path: envPath, force: true, override: true })

    expect(process.env.POSTGRES_USER).toBe('dmforge')
    expect(process.env.DATABASE_URL).toBe('postgresql://dmforge:secret@localhost:5432/dmforge')
  })

  it('é idempotente sem force', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dmforge-env-'))
    const envPath = join(dir, '.env')
    writeFileSync(envPath, 'FOO=primeiro\n')

    loadEnv({ path: envPath, force: true, override: true })
    expect(process.env.FOO).toBe('primeiro')

    writeFileSync(envPath, 'FOO=segundo\n')
    loadEnv({ path: envPath, override: true })
    expect(process.env.FOO).toBe('primeiro')
  })
})
