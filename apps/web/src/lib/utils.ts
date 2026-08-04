import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// The class-name helper every shadcn/ui component imports: `clsx` resolves the
// conditional forms, `twMerge` makes a later Tailwind class win over an earlier
// one that targets the same property (so a `className` prop can actually
// override a component's own defaults instead of fighting it on specificity).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
