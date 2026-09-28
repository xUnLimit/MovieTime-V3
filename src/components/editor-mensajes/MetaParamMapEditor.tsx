'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DATA_KEY_OPTIONS, dataKeyLabel, resizeParamMap } from '@/modules/messaging/meta-template-mapping';

type MetaParamMapEditorProps = {
  paramCount: number;
  value: string[];
  error: string | null;
  onChange: (map: string[]) => void;
};

// Una fila por {{n}} de la plantilla: "{{1}} → Saludo y nombre".
export function MetaParamMapEditor({ paramCount, value, error, onChange }: MetaParamMapEditorProps) {
  const setKey = (index: number, key: string) => {
    const next = resizeParamMap(value, paramCount);
    next[index] = key;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">Qué dato va en cada variable</p>
        <p className="text-xs text-muted-foreground">Meta reemplaza cada {'{{n}}'} por el dato que elijas.</p>
      </div>
      <ul className="space-y-2">
        {Array.from({ length: paramCount }, (_, index) => {
          const id = `meta-param-${index + 1}`;
          return (
            <li key={id} className="flex items-center gap-2">
              <Label htmlFor={id} className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{`{{${index + 1}}} →`}</Label>
              <Select value={value[index] || undefined} onValueChange={(key) => setKey(index, key)}>
                <SelectTrigger id={id} className="w-full" aria-label={`Dato para la variable ${index + 1}`}>
                  <SelectValue placeholder="Elige un dato">{value[index] ? dataKeyLabel(value[index]) : undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DATA_KEY_OPTIONS.map((option) => (
                    <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
