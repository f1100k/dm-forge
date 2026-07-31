import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Standard shadcn/ui class combiner: clsx for conditional joins, tailwind-merge
// to resolve conflicting Tailwind utilities (last one wins).
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
