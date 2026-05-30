import type { ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

import { cn } from '@/platform/utils';

interface FilterTriggerContentProps {
  icon: LucideIcon;
  label: ReactNode;
  labelClassName?: string;
}

export function FilterTriggerContent({
  icon: Icon,
  label,
  labelClassName,
}: FilterTriggerContentProps) {
  return (
    <>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className={cn('min-w-0 flex-1 truncate text-left', labelClassName)}>
        {label}
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
    </>
  );
}
