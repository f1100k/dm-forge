import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils.js'

// Native checkbox styled to match the design system. `accent-primary` colours
// the checked state without a Radix dependency; keyboard/label semantics come
// for free from the native element (NFR-006 accessibility).
export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 shrink-0 rounded border border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
