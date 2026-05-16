import { generateText } from 'ai'
import { z } from 'zod'
import { createOpenRouterClient } from '../provider/openrouter.js'

// Example function. Demonstrates the typed-function contract of packages/ai:
// receives the decrypted BYOK key + a validated input, returns a typed value.
// Replace with real functions (generateScene, summarizeNpc, ...) as features
// land.

export const GenerateGreetingInputSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().default('openai/gpt-4o-mini'),
  audienceName: z.string().min(1),
})

export type GenerateGreetingInput = z.infer<typeof GenerateGreetingInputSchema>

export async function generateGreeting(input: GenerateGreetingInput): Promise<string> {
  const { apiKey, model, audienceName } = GenerateGreetingInputSchema.parse(input)
  const openrouter = createOpenRouterClient(apiKey)
  const { text } = await generateText({
    model: openrouter(model),
    prompt: `Greet "${audienceName}" in a single short sentence in the tone of an RPG game master.`,
  })
  return text
}
