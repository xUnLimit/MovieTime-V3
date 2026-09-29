'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUTTON_ACTIONS, resizeButtonActions } from '@/modules/messaging/button-actions';
import type { MetaTemplateButton } from '@/modules/messaging/meta-template-mapping';

type MetaButtonActionsProps = {
  buttons: MetaTemplateButton[];
  value: string[];
  onChange: (actions: string[]) => void;
};

// Qué hace el sistema cuando el cliente toca cada botón de respuesta rápida.
export function MetaButtonActions({ buttons, value, onChange }: MetaButtonActionsProps) {
  const actions = resizeButtonActions(value, buttons.length);
  const setAction = (index: number, action: string) => {
    const next: string[] = [...actions];
    next[index] = action;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-medium">Botones de la plantilla</h3>
        <p className="text-xs text-muted-foreground">Elige qué pasa cuando el cliente toca cada botón.</p>
      </div>
      <ul className="space-y-2" aria-label="Botones de la plantilla">
        {buttons.map((button, index) => {
          const id = `meta-button-${index}`;
          return (
            <li key={`${button.type}-${index}`} className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-3">
              <Label htmlFor={id} className="truncate text-xs font-medium" title={button.text}>{button.text}</Label>
              <Select value={actions[index]} onValueChange={(action) => setAction(index, action)}>
                <SelectTrigger id={id} className="w-full" aria-label={`Qué hace el botón ${button.text}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUTTON_ACTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
