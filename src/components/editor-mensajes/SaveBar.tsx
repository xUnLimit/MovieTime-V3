'use client';

import { Button } from '@/components/ui/button';

type SaveBarProps = {
  dirty: boolean;
  invalid: boolean;
  saving: boolean;
  justSaved: boolean;
  onSave: () => void;
};

/** Pie fijo de la tarjeta del editor: estado de los cambios y el boton Guardar siempre en el mismo lugar. */
export function SaveBar({ dirty, invalid, saving, justSaved, onSave }: SaveBarProps) {
  const status = saving ? 'Guardando...' : dirty ? 'Cambios sin guardar' : justSaved ? 'Todos los cambios guardados' : 'Sin cambios';
  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t bg-card px-4 py-2">
      <p role="status" aria-live="polite" className={dirty ? 'text-sm font-medium text-warning' : 'text-sm text-muted-foreground'}>
        {status}
      </p>
      <Button type="button" onClick={onSave} disabled={!dirty || invalid || saving}>
        Guardar
      </Button>
    </div>
  );
}
