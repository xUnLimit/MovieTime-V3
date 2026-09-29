import { AlertCircle, Plus, RefreshCw } from 'lucide-react';

import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';

import { LabSection } from './LabSection';

export function StatesSection() {
  return (
    <LabSection id="feedback" title="Vacío, carga y error" description="Todo dato remoto tiene los tres estados. El error nombra el problema y ofrece reintentar.">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card">
          <EmptyState
            message="Aún no hay ventas"
            description="Crea la primera venta para empezar a ver vencimientos y pagos."
            action={
              <Button size="sm">
                <Plus /> Nueva venta
              </Button>
            }
          />
        </div>
        <div className="flex items-center justify-center gap-3 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          <LoadingSpinner /> Cargando ventas…
        </div>
        <div className="flex flex-col justify-center gap-3 rounded-xl border border-danger-border bg-danger-subtle p-5">
          <div className="flex items-start gap-2 text-danger">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">No se pudieron cargar las métricas</p>
              <p className="text-sm">Revisa tu conexión e intenta de nuevo.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="w-fit">
            <RefreshCw /> Reintentar
          </Button>
        </div>
      </div>
    </LabSection>
  );
}
