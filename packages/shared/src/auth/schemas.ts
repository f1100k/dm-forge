import { z } from 'zod'

export const EmailSchema = z.string().trim().toLowerCase().email()

export const PasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters long')

export const LocaleSchema = z.enum(['pt-BR', 'en'])
export type Locale = z.infer<typeof LocaleSchema>

export const ConsentTypeSchema = z.enum(['TERMS', 'PRIVACY', 'TELEMETRY'])
export type ConsentType = z.infer<typeof ConsentTypeSchema>
