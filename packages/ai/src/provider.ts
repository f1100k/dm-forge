import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// OpenRouter client factory using the user's BYOK key. The key is NEVER
// cached between requests — decrypt and instantiate on every call.
export function createOpenRouterClient(decryptedApiKey: string) {
  return createOpenRouter({
    apiKey: decryptedApiKey,
  })
}
