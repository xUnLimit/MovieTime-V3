'use client';

import { Button } from '@/components/ui/button';
import { PanelFooter } from './PanelFrame';

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
    <PanelFooter>
      <p role="status" aria-live="polite" className={dirty ? 'flex items-center gap-2 text-sm font-medium text-warning' : 'text-sm text-muted-foreground'}>
        {dirty ? <span aria-hidden className="size-2 rounded-full bg-warning" /> : null}
        {status}
      </p>
      <Button type="button" onClick={onSave} disabled={!dirty || invalid || saving}>
        Guardar
      </Button>
    </PanelFooter>
  );
}
