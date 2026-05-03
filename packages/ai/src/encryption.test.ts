import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decryptApiKey, encryptApiKey } from './encryption.js'

const validMasterKey = randomBytes(32).toString('base64')

describe('encryptApiKey / decryptApiKey', () => {
  it('faz round-trip de uma chave BYOK', () => {
    const plaintext = 'sk-or-v1-abcdef0123456789'
    const secret = encryptApiKey(plaintext, validMasterKey)
    expect(decryptApiKey(secret, validMasterKey)).toBe(plaintext)
  })

  it('produz IVs diferentes para o mesmo plaintext (não-determinístico)', () => {
    const a = encryptApiKey('chave', validMasterKey)
    const b = encryptApiKey('chave', validMasterKey)
    expect(a.iv.equals(b.iv)).toBe(false)
    expect(a.encryptedKey.equals(b.encryptedKey)).toBe(false)
  })

  it('rejeita chave-mestra com tamanho incorreto', () => {
    const shortKey = randomBytes(16).toString('base64')
    expect(() => encryptApiKey('x', shortKey)).toThrowError(/ENCRYPTION_KEY/)
  })

  it('falha ao decriptar quando o authTag é adulterado', () => {
    const secret = encryptApiKey('chave', validMasterKey)
    const tampered = {
      ...secret,
      authTag: Buffer.from(secret.authTag.map((b) => b ^ 0xff)),
    }
    expect(() => decryptApiKey(tampered, validMasterKey)).toThrow()
  })
})
