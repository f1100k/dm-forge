import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// Fábrica de cliente OpenRouter com a chave BYOK do usuário. A chave NUNCA é
// cacheada entre requests — descriptografar e instanciar a cada chamada.
export function createOpenRouterClient(decryptedApiKey: string) {
  return createOpenRouter({
    apiKey: decryptedApiKey,
  })
}
