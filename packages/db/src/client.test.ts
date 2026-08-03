import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

// The connection string is captured when this module is evaluated, so the
// package has to be self-sufficient about finding it: a consumer whose module
// graph reaches `@dm-forge/db` before its own env module must still get a
// working client. Getting this wrong is invisible until the first query, which
// fails as a SASL "client password must be a string".
//
// A real child process rather than a mocked env: module evaluation happens once
// per process, and the behaviour under test *is* what happens on that first
// evaluation.

const here = dirname(fileURLToPath(import.meta.url))
// Inside the package so Node still resolves its dependencies, but deep enough
// that the nearest `.env` walking up is the fixture and not the repo's own.
const sandbox = resolve(here, '../.tmp-env-import-test')

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

describe('@dm-forge/db client module', () => {
  it('reads the connection string from the project .env without being asked', () => {
    // Arrange — a directory whose nearest .env is the fixture, and an
    // environment that carries no DATABASE_URL of its own.
    mkdirSync(sandbox, { recursive: true })
    writeFileSync(
      resolve(sandbox, '.env'),
      'DATABASE_URL=postgresql://someone:secret@localhost:5433/fixture\n',
    )
    const env = { ...process.env }
    delete env.DATABASE_URL

    // Act — a fresh process that does nothing but import the package, the way
    // a consumer would before its own env module has run.
    const output = execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--eval',
        "import('../src/client.js').then(() => console.log(process.env.DATABASE_URL ?? ''))",
      ],
      { cwd: sandbox, env, encoding: 'utf8' },
    )

    // Assert
    expect(output.trim()).toBe('postgresql://someone:secret@localhost:5433/fixture')
  })

  it('leaves a connection string already in the environment alone', () => {
    // Arrange — the same fixture .env, but the process was started with its own
    // DATABASE_URL (a deployment, or the integration harness).
    mkdirSync(sandbox, { recursive: true })
    writeFileSync(
      resolve(sandbox, '.env'),
      'DATABASE_URL=postgresql://someone:secret@localhost:5433/fixture\n',
    )
    const env = { ...process.env, DATABASE_URL: 'postgresql://real:real@db:5432/real' }

    // Act
    const output = execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--eval',
        "import('../src/client.js').then(() => console.log(process.env.DATABASE_URL ?? ''))",
      ],
      { cwd: sandbox, env, encoding: 'utf8' },
    )

    // Assert — 12-factor: the system environment wins over the file, so loading
    // the .env here can never redirect a deployed app at the wrong database.
    expect(output.trim()).toBe('postgresql://real:real@db:5432/real')
  })
})
