'use client';

import { useState } from 'react';
import { FLOW_TEMPLATES, type FlowTemplateId } from '@/modules/bot-config';
import { Button } from '@/components/ui/button';
import type { FlowActions } from './flow-actions';
import { SELECT_CLASS } from './OptionRow';

/** Parte de una plantilla predefinida. Reemplaza el borrador (no lo publicado) y pide confirmar antes de hacerlo. */
export function TemplatePicker({ actions }: { actions: FlowActions }) {
  const [id, setId] = useState<FlowTemplateId>('base');
  const [confirming, setConfirming] = useState(false);
  const template = FLOW_TEMPLATES.find((item) => item.id === id) ?? FLOW_TEMPLATES[0];
  return <div className="space-y-2">
    <div className="flex flex-wrap items-end gap-2">
      <label className="block min-w-48 flex-1 text-sm font-medium">Plantilla de recorrido
        <select className={SELECT_CLASS} value={id} onChange={(event) => { setId(event.target.value as FlowTemplateId); setConfirming(false); }}>
          {FLOW_TEMPLATES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <Button variant="outline" onClick={() => setConfirming(true)}>Usar plantilla</Button>
    </div>
    <p className="text-xs text-muted-foreground">{template.description}</p>
    {confirming ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
      <span>Esto reemplaza todo el borrador actual. Lo publicado no cambia hasta que publiques; puedes descartar el borrador antes.</span>
      <Button onClick={() => { setConfirming(false); void actions.applyTemplate(id); }}>Reemplazar borrador</Button>
      <Button variant="outline" onClick={() => setConfirming(false)}>Cancelar</Button>
    </div> : null}
  </div>;
}
