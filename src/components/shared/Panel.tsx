import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/platform/utils';

interface PanelProps {
  title: ReactNode;
  description?: ReactNode;
  /** Controles del encabezado (filtros, paginador). */
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** El contenido llena el alto restante del panel (requiere alto definido). Para graficos responsivos. */
  fill?: boolean;
}

/** Contenedor estandar de widgets (graficos, listas): encabezado, contenido y pie con la misma rejilla. */
export function Panel({ title, description, actions, footer, children, className, contentClassName, fill = false }: PanelProps) {
  return (
    <Card data-slot="panel" className={cn('gap-0 overflow-hidden py-0', className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1 basis-40 space-y-0.5">
          <h2 className="text-sm leading-5 font-semibold tracking-tight">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      <div className={cn('min-h-0 flex-1 px-4 pb-4', fill && 'relative', contentClassName)}>
        {fill ? <div className="absolute inset-x-4 top-0 bottom-4">{children}</div> : children}
      </div>
      {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
    </Card>
  );
}
