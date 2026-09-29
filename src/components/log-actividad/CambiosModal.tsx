'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CambioLog } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowRight } from 'lucide-react';

interface CambiosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entidadNombre: string;
  cambios: CambioLog[];
  metadata?: Record<string, unknown>;
}

export function CambiosModal({ open, onOpenChange, entidadNombre, cambios, metadata }: CambiosModalProps) {
  const metadataEntries = getMetadataEntries(metadata);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-medium text-foreground">
            Cambios en <span className="text-primary font-semibold">{entidadNombre}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detalle de los cambios registrados para esta actividad.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {cambios.map((cambio, idx) => (
            <div
              key={idx}
              className="group relative bg-card border border-border/50 rounded-lg p-4 hover:border-primary/30 hover:bg-primary/15 transition-all duration-200"
            >
              {/* Campo Label minimalista */}
              <div className="mb-3">
                <span className="text-xs font-medium text-primary uppercase tracking-wider">
                  {cambio.campo}
                </span>
              </div>

              {/* Comparación compacta */}
              <div className="flex items-center gap-4">
                {/* Valor Anterior */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-danger"></div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Anterior</span>
                  </div>
                  <div className="bg-danger-subtle border border-danger-border rounded-md px-3 py-2">
                    <p className="text-sm text-danger truncate" title={formatCambioValue(cambio.anterior, cambio.tipo, cambio.campoKey)}>
                      {formatCambioValue(cambio.anterior, cambio.tipo, cambio.campoKey)}
                    </p>
                  </div>
                </div>

                {/* Flecha minimalista */}
                <div className="flex-shrink-0 pt-5">
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                </div>

                {/* Valor Nuevo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Actual</span>
                  </div>
                  <div className="bg-success-subtle border border-success-border rounded-md px-3 py-2">
                    <p className="text-sm text-success truncate" title={formatCambioValue(cambio.nuevo, cambio.tipo, cambio.campoKey)}>
                      {formatCambioValue(cambio.nuevo, cambio.tipo, cambio.campoKey)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {metadataEntries.length > 0 ? (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
              <div className="mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Metadata estructurada
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {metadataEntries.map(([key, value]) => (
                  <div key={key} className="rounded-md border bg-card px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {formatMetadataKey(key)}
                    </p>
                    <p className="mt-1 truncate text-sm text-foreground" title={formatMetadataValue(value)}>
                      {formatMetadataValue(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Formatea valores según su tipo
 */
export function formatCambioValue(value: unknown, tipo?: CambioLog['tipo'], campoKey?: string): string {
  if (value === null || value === undefined) return '(vacío)';

  switch (tipo) {
    case 'date':
      {
        const date = parseCambioDate(value);
        if (date) return format(date, 'dd/MM/yyyy', { locale: es });
      }
      return String(value);

    case 'money':
      return `$${Number(value).toFixed(2)}`;

    case 'boolean': {
      const boolValue = value === true || value === 'true' || value === 1;
      if (campoKey === 'enReposo' || campoKey === 'reposo') {
        return boolValue ? 'En reposo' : 'Fuera de reposo';
      }
      return boolValue ? 'Activo' : 'Inactivo';
    }

    case 'number':
      return String(value);

    case 'string':
    default:
      return String(value);
  }
}

export function getMetadataEntries(metadata?: Record<string, unknown>): [string, unknown][] {
  if (!metadata) return [];
  return Object.entries(metadata).filter(([, value]) => value !== undefined);
}

export function formatMetadataKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

export function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return '(vacío)';
  if (value instanceof Date) return format(value, 'dd/MM/yyyy', { locale: es });
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseCambioDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string') return null;

  const trimmedValue = value.trim();
  const dateOnlyMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(trimmedValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
