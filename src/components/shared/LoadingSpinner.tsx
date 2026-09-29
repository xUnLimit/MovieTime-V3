'use client';

import { Loader2 } from 'lucide-react';

import { cn } from '@/platform/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-10',
} as const;

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label="Cargando"
      className={cn('animate-spin text-muted-foreground', SIZE_CLASSES[size], className)}
    />
  );
}
