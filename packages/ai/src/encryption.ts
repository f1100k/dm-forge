import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// AES-256-GCM para chaves BYOK. Regras (ver docs/architecture-overview.md):
//  * Chave-mestra de 32 bytes (256 bits), fornecida em base64 via ENCRYPTION_KEY.
//  * IV (nonce) de 12 bytes, gerado aleatoriamente a cada operação.
//  * authTag de 16 bytes (default do GCM) para detectar adulteração.
//  * Decriptar SOMENTE em memória, dentro do request que vai usar a chave.

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
      `ENCRYPTION_KEY inválida: esperado ${KEY_BYTES} bytes em base64, recebido ${key.length}.`,
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
