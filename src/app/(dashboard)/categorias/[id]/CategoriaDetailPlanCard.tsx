import { ChevronDown, DollarSign } from 'lucide-react';

import type { Plan } from '@/types';
import { getCicloPagoLabel } from './categoria-detail-helpers';

interface CategoriaDetailPlanCardProps {
  accentColor: string;
  expandedPlan: string | null;
  onToggle: (planId: string) => void;
  plan: Plan;
  tipoPlanNombre: string;
}

export function CategoriaDetailPlanCard({
  accentColor,
  expandedPlan,
  onToggle,
  plan,
  tipoPlanNombre,
}: CategoriaDetailPlanCardProps) {
  const isOpen = expandedPlan === plan.id;
  const cicloPago = getCicloPagoLabel(plan.cicloPago);

  return (
    <div
      className={`rounded-lg border overflow-hidden cursor-pointer ${accentColor}`}
      onClick={() => onToggle(plan.id)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <DollarSign className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{plan.nombre || 'Plan sin nombre'}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="px-4 pb-3 pt-0 border-t mt-0">
          <div className="pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tipo de plan</span>
              <span className="text-xs font-medium text-primary">{tipoPlanNombre}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ciclo de pago</span>
              <span className="text-xs font-medium">{cicloPago.label}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Precio</span>
              <span className="text-xs font-semibold">
                ${plan.precio.toFixed(2)}
                <span className="font-normal text-muted-foreground">/{cicloPago.short}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
