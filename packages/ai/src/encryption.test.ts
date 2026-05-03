import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decryptApiKey, encryptApiKey } from './encryption.js'

const validMasterKey = randomBytes(32).toString('base64')

describe('encryptApiKey / decryptApiKey', () => {
  it('round-trips a BYOK key', () => {
    const plaintext = 'sk-or-v1-abcdef0123456789'
    const secret = encryptApiKey(plaintext, validMasterKey)
    expect(decryptApiKey(secret, validMasterKey)).toBe(plaintext)
  })

  it('produces different IVs for the same plaintext (non-deterministic)', () => {
    const a = encryptApiKey('key', validMasterKey)
    const b = encryptApiKey('key', validMasterKey)
    expect(a.iv.equals(b.iv)).toBe(false)
    expect(a.encryptedKey.equals(b.encryptedKey)).toBe(false)
  })

  it('rejects a master key with the wrong size', () => {
    const shortKey = randomBytes(16).toString('base64')
    expect(() => encryptApiKey('x', shortKey)).toThrowError(/ENCRYPTION_KEY/)
  })

  it('fails to decrypt when the authTag is tampered with', () => {
    const secret = encryptApiKey('key', validMasterKey)
    const tampered = {
      ...secret,
      authTag: Buffer.from(secret.authTag.map((b) => b ^ 0xff)),
    }
    expect(() => decryptApiKey(tampered, validMasterKey)).toThrow()
  })
})
