import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

let loaded = false

export type LoadEnvOptions = {
  // Caminho explícito para o `.env`. Se omitido, faz walk-up a partir do cwd
  // até achar o primeiro `.env` na árvore.
  path?: string
  // Permite re-carregar (útil em testes). Padrão: idempotente.
  force?: boolean
  // Quando true, valores do `.env` sobrescrevem variáveis já presentes em
  // process.env. Padrão false (12-factor: env do sistema vence o arquivo).
  override?: boolean
}

// Lê o .env do projeto e aplica expansão de variáveis (${OUTRA_VAR}) antes de
// popular process.env. Deve ser chamado UMA vez no boot do processo, antes de
// qualquer leitura de process.env (ver apps/api/src/load-env.ts).
export function loadEnv(options: LoadEnvOptions = {}): void {
  if (loaded && !options.force) return
  const envPath = options.path ?? findEnvFile(process.cwd())
  if (envPath) {
    const result = config({ path: envPath, quiet: true, override: options.override })
    expand({ ...result, override: options.override })
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
