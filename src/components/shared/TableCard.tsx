import type { ReactNode, Ref } from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/platform/utils';

export interface TableCardProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Acciones del encabezado de la tabla (derecha). */
  actions?: ReactNode;
  /** `TableToolbar` con la busqueda y los filtros propios de cada tabla. */
  toolbar?: ReactNode;
  /** Paginacion u otros controles al pie. */
  footer?: ReactNode;
  /** Region donde vive la tabla; se usa para calcular cuantas filas caben en pantalla. */
  bodyRef?: Ref<HTMLDivElement>;
  children: ReactNode;
  className?: string;
}

/**
 * Molde unico de tabla: encabezado, filtros, tabla a sangre completa y pie de paginacion con la misma
 * rejilla, espaciado y bordes en todo el sistema. Cada tabla aporta solo lo suyo: columnas, filtros y acciones.
 */
export function TableCard({ title, description, actions, toolbar, footer, bodyRef, children, className }: TableCardProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <Card data-slot="table-card" className={cn('gap-0 overflow-hidden py-0', className)}>
      {hasHeader ? (
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0 space-y-0.5">
            {title ? <h2 className="text-sm leading-5 font-semibold tracking-tight">{title}</h2> : null}
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {toolbar ? <div className={cn('px-4 pb-3', !hasHeader && 'pt-4')}>{toolbar}</div> : null}
      <div ref={bodyRef} data-slot="table-card-body" className="@container min-w-0 border-t [&_tr>:first-child]:pl-4 [&_tr>:last-child]:pr-4">
        {children}
      </div>
      {footer ? <div className="border-t px-4 py-2">{footer}</div> : null}
    </Card>
  );
}
