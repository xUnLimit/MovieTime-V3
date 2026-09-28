'use client';

import { Button } from '@/components/ui/button';

type SaveBarProps = {
  dirty: boolean;
  invalid: boolean;
  saving: boolean;
  justSaved: boolean;
  onSave: () => void;
};

export function SaveBar({ dirty, invalid, saving, justSaved, onSave }: SaveBarProps) {
  const status = saving ? 'Guardando...' : dirty ? 'Cambios sin guardar' : justSaved ? 'Todos los cambios guardados' : '';
  return (
    <div className="sticky bottom-2 z-10 flex items-center justify-between gap-3 rounded-lg border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
      <p role="status" aria-live="polite" className={dirty ? 'text-sm font-medium text-amber-500' : 'text-sm text-muted-foreground'}>
        {status}
      </p>
      <Button type="button" size="sm" onClick={onSave} disabled={!dirty || invalid || saving}>
        Guardar
      </Button>
    </div>
  );
}
