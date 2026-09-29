import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';

import { LabRow, LabSection } from './LabSection';

export function StatusSection() {
  return (
    <LabSection id="estados" title="Badges y estados" description="El estado siempre lleva punto y texto; el color refuerza, no reemplaza.">
      <div className="space-y-5 rounded-xl border bg-card p-5">
        <LabRow label="StatusBadge (uso en tablas y listas)">
          <StatusBadge tone="success">Activa</StatusBadge>
          <StatusBadge tone="warning">3 días restantes</StatusBadge>
          <StatusBadge tone="danger">2 días de retraso</StatusBadge>
          <StatusBadge tone="danger">Vence hoy</StatusBadge>
          <StatusBadge tone="info">En reposo</StatusBadge>
          <StatusBadge tone="brand">Revendedor</StatusBadge>
          <StatusBadge tone="neutral">Inactiva</StatusBadge>
        </LabRow>
        <LabRow label="Badge (etiquetas sin estado)">
          <Badge>default</Badge>
          <Badge variant="secondary">secondary</Badge>
          <Badge variant="outline">outline</Badge>
          <Badge variant="destructive">destructive</Badge>
        </LabRow>
      </div>
    </LabSection>
  );
}
