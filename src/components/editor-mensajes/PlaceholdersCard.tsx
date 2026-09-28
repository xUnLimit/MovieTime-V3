'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { PLACEHOLDERS } from './editor-constants';

async function copyPlaceholder(placeholder: string) {
  try {
    await navigator.clipboard.writeText(placeholder);
    toast.success('Placeholder copiado', { description: 'El placeholder ha sido copiado al portapapeles.' });
  } catch (error) {
    toast.error('Error al copiar', { description: getPublicErrorMessage(error, 'No se pudo copiar el mensaje.') });
  }
}

export function PlaceholdersCard() {
  return (
    <Card className="p-5">
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Placeholders Disponibles</h3>
          <p className="text-sm text-muted-foreground">
            Usa estos placeholders en tu mensaje. Serán reemplazados por los valores reales.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {PLACEHOLDERS.map((placeholder) => {
            const Icon = placeholder.icon;
            return (
              <div
                key={placeholder.key}
                className="p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <code className="text-xs font-semibold block text-foreground">
                        <span className="break-all">{placeholder.key}</span>
                      </code>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                        {placeholder.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => copyPlaceholder(placeholder.key)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
