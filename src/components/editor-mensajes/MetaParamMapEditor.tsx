'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DATA_KEY_OPTIONS, resizeParamMap } from '@/modules/messaging/meta-template-mapping';

type MetaParamMapEditorProps = {
  paramCount: number;
  value: string[];
  error: string | null;
  onChange: (map: string[]) => void;
};

// Un select por {{n}} de la plantilla de Meta: elige que dato del mensaje va en cada variable.
export function MetaParamMapEditor({ paramCount, value, error, onChange }: MetaParamMapEditorProps) {
  const setKey = (index: number, key: string) => {
    const next = resizeParamMap(value, paramCount);
    next[index] = key;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Datos de las variables</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: paramCount }, (_, index) => {
          const id = `meta-param-${index + 1}`;
          return (
            <div key={id} className="space-y-1">
              <Label htmlFor={id} className="text-xs text-muted-foreground">{`Variable {{${index + 1}}}`}</Label>
              <Select value={value[index] || undefined} onValueChange={(key) => setKey(index, key)}>
                <SelectTrigger id={id} className="w-full" aria-label={`Dato para la variable ${index + 1}`}>
                  <SelectValue placeholder="Elige un dato" />
                </SelectTrigger>
                <SelectContent>
                  {DATA_KEY_OPTIONS.map((option) => (
                    <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
