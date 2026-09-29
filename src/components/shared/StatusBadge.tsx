import type { ComponentProps } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/platform/utils';

import { toneDot, type Tone } from './tone';

interface StatusBadgeProps extends Omit<ComponentProps<typeof Badge>, 'variant' | 'asChild'> {
  tone?: Tone;
  /** Punto de color antes del texto: el estado nunca se comunica solo con color. */
  dot?: boolean;
}

export function StatusBadge({
  tone = 'neutral',
  dot = true,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge variant={tone} data-tone={tone} className={cn('gap-1.5', className)} {...props}>
      {dot ? <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', toneDot[tone])} /> : null}
      {children}
    </Badge>
  );
}
