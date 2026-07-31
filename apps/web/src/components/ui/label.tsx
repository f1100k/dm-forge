import type { LabelHTMLAttributes } from 'react'
import { cn } from '../../lib/utils.js'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  // biome-ignore lint/a11y/noLabelWithoutControl: generic label primitive; every call site passes htmlFor to associate it with its input.
  return <label className={cn('text-sm font-medium leading-none', className)} {...props} />
}
