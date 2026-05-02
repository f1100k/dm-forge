import { createId as cuid2, isCuid as isCuid2 } from '@paralleldrive/cuid2'

// Gerador único de IDs do projeto. Use sempre este helper em vez de chamar
// cuid2 diretamente — assim qualquer mudança futura (length, prefixo) acontece
// em um único lugar (Constitution principle 4 + docs/coding-patterns.md).
export function createId(): string {
  return cuid2()
}

export function isCuid(value: string): boolean {
  return isCuid2(value)
}
