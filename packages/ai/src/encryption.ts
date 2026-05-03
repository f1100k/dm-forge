import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// AES-256-GCM for BYOK keys. Rules (see docs/architecture-overview.md):
//  * 32-byte (256-bit) master key, supplied in base64 via ENCRYPTION_KEY.
//  * 12-byte IV (nonce), generated randomly on every operation.
//  * 16-byte authTag (GCM default) to detect tampering.
//  * Decrypt ONLY in memory, inside the request that will use the key.

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const KEY_BYTES = 32

export type EncryptedSecret = {
  encryptedKey: Buffer
  iv: Buffer
  authTag: Buffer
}

function loadMasterKey(masterKeyBase64: string): Buffer {
  const key = Buffer.from(masterKeyBase64, 'base64')
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `invalid ENCRYPTION_KEY: expected ${KEY_BYTES} bytes in base64, got ${key.length}.`,
    )
  }
  return key
}

export function encryptApiKey(plaintext: string, masterKeyBase64: string): EncryptedSecret {
  const masterKey = loadMasterKey(masterKeyBase64)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, masterKey, iv)
  const encryptedKey = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return { encryptedKey, iv, authTag }
}

export function decryptApiKey(secret: EncryptedSecret, masterKeyBase64: string): string {
  const masterKey = loadMasterKey(masterKeyBase64)
  const decipher = createDecipheriv(ALGORITHM, masterKey, secret.iv)
  decipher.setAuthTag(secret.authTag)
  const plaintext = Buffer.concat([decipher.update(secret.encryptedKey), decipher.final()])
  return plaintext.toString('utf8')
}
