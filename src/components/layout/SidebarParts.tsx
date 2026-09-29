'use client';

import type { ComponentType, ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/platform/utils';

/** Anchos en px. El icono queda centrado en la columna colapsada (8px de margen + 12px de padding + 8px de medio icono = 28px). */
export const SIDEBAR_WIDTH = { expanded: 224, collapsed: 56, mobile: 272 } as const;

export function sidebarRowClassName(active = false) {
  return cn(
    'relative flex h-8 w-full items-center gap-3 overflow-hidden rounded-md pr-2 pl-3 text-sm outline-none',
    'transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sidebar-ring',
    active
      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
  );
}

interface SidebarRowContentProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  hideLabel: boolean;
  active?: boolean;
  iconClassName?: string;
  /** Contador junto al texto (expandido) y punto sobre el icono (colapsado). */
  badge?: string;
  badgeLabel?: string;
}

export function SidebarRowContent({ icon: Icon, label, hideLabel, active, iconClassName, badge, badgeLabel }: SidebarRowContentProps) {
  return (
    <>
      <Icon className={cn('size-4 shrink-0', active && 'text-primary', iconClassName)} />
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap transition-opacity duration-200',
          hideLabel && 'pointer-events-none opacity-0'
        )}
      >
        <span className="truncate">{label}</span>
        {badge ? (
          <span
            className="ml-auto rounded-md bg-primary px-1.5 text-xs leading-5 font-semibold text-primary-foreground tabular-nums"
            aria-label={badgeLabel}
          >
            {badge}
          </span>
        ) : null}
      </span>
      {badge && hideLabel ? <span aria-hidden className="absolute top-1.5 left-[24px] size-2 rounded-full bg-primary" /> : null}
    </>
  );
}

export function SidebarTooltip({ label, enabled, children }: { label: string; enabled: boolean; children: ReactNode }) {
  if (!enabled) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
