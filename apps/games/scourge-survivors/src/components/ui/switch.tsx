import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'pointer-events-auto cursor-pointer peer inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-sm border border-[var(--ssg-gunmetal)] transition-colors',
      'data-[state=checked]:bg-[var(--ssg-hellfire)] data-[state=checked]:border-[var(--ssg-hellfire)] data-[state=unchecked]:bg-black/40',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ssg-hellfire)]/60',
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-[16px] w-[16px] translate-x-[3px] rounded-sm bg-[var(--ssg-bone)] shadow-sm transition-transform data-[state=checked]:translate-x-[21px] data-[state=checked]:bg-[var(--ssg-void)]" />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'
