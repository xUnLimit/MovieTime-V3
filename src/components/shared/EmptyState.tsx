'use client';

import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  message = 'No hay datos disponibles',
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
        {icon || <Inbox aria-hidden className="size-5" />}
      </div>
      <h3 className="text-sm font-medium text-foreground">{message}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
