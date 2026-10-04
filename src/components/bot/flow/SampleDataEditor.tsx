'use client';

import { CONDITION_CATALOG, CONDITION_TYPES, NODE_VARIABLE_CATALOG, type SimulationSample } from '@/modules/bot-config';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type SampleDataEditorProps = { sample: SimulationSample; onChange: (sample: SimulationSample) => void };

/** Datos de ejemplo del simulador: que respondera cada condicion y que valor tiene cada dato del pedido. No sale nada del navegador. */
export function SampleDataEditor({ sample, onChange }: SampleDataEditorProps) {
  return <details className="rounded-md border p-3 text-sm">
    <summary className="cursor-pointer font-medium">Datos de ejemplo de la simulación</summary>
    <div className="mt-3 space-y-3">
      <p className="text-xs text-muted-foreground">Cambia los datos y vuelve a iniciar la simulación. No se envían mensajes ni se consultan clientes reales.</p>
      <div className="space-y-2">
        {CONDITION_TYPES.map((type) => <div key={type} className="flex items-center justify-between gap-3">
          <Label htmlFor={`sample-${type}`}>{CONDITION_CATALOG[type].label}: {sample.facts[type] ? CONDITION_CATALOG[type].yes : CONDITION_CATALOG[type].no}</Label>
          <Switch id={`sample-${type}`} checked={sample.facts[type]}
            onCheckedChange={(checked) => onChange({ ...sample, facts: { ...sample.facts, [type]: checked } })} />
        </div>)}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(NODE_VARIABLE_CATALOG).map(([name, spec]) => <div key={name} className="space-y-1">
          <Label htmlFor={`sample-${name}`}>{spec.label}</Label>
          <Input id={`sample-${name}`} maxLength={40} value={sample.values[name] ?? ''}
            onChange={(event) => onChange({ ...sample, values: { ...sample.values, [name]: event.target.value } })} />
        </div>)}
      </div>
    </div>
  </details>;
}
