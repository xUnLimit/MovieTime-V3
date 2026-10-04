'use client';

import { NODE_LIMITS, NODE_VARIABLE_CATALOG } from '@/modules/bot-config';
import { Button } from '@/components/ui/button';

type VariableHintsProps = { body: string; onInsert: (marker: string) => void };

/** Datos del pedido que un texto puede mostrar: lista cerrada que el servidor resuelve; no hay expresiones libres. */
export function VariableHints({ body, onInsert }: VariableHintsProps) {
  return <div role="group" aria-label="Datos del pedido" className="space-y-1.5">
    <p className="text-xs text-muted-foreground">Datos del pedido que puedes insertar. Si el cliente no tiene un pedido abierto se muestra «—».</p>
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(NODE_VARIABLE_CATALOG).map(([name, spec]) => {
        const marker = `{{${name}}}`;
        return <Button key={name} type="button" size="sm" variant="outline" aria-label={`Insertar ${spec.label}`}
          disabled={body.length + marker.length > NODE_LIMITS.bodyMax} onClick={() => onInsert(marker)}>{spec.label}</Button>;
      })}
    </div>
  </div>;
}
