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
      <div className="rounded-full bg-muted p-3 mb-4">
        {icon || <Inbox className="h-10 w-10 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{message}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
