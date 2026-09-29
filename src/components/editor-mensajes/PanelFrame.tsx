import type { ReactNode } from 'react';

import { cn } from '@/platform/utils';

// Cabecera y pie de los tres paneles del editor: misma altura en todos para que las lineas queden alineadas.
// `strong` es el tono de los paneles laterales (lista y celular); el panel central usa el tono base.
const BAND = { base: 'bg-muted/30', strong: 'bg-muted/60' } as const;

type Tone = keyof typeof BAND;

export function PanelHeader({ title, description, actions, tone = 'base', className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; tone?: Tone; className?: string }) {
  return (
    <header className={cn('flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4', BAND[tone], className)}>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        {description ? <p className="truncate text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PanelFooter({ children, tone = 'base', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <footer className={cn('mt-auto flex h-12 shrink-0 items-center justify-between gap-3 border-t px-4', BAND[tone], className)}>{children}</footer>;
}
