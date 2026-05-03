import { generateText } from 'ai'
import { z } from 'zod'
import { createOpenRouterClient } from '../provider.js'

// Função-exemplo. Demonstra o contrato de funções tipadas do packages/ai:
// recebe a chave BYOK decifrada + um input validado, devolve um valor tipado.
// Substituir por funções reais (generateScene, summarizeNpc, ...) conforme
// as features cheguem.

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
    prompt: `Cumprimente "${audienceName}" em uma frase curta no tom de um mestre de RPG.`,
  })
  return text
}
