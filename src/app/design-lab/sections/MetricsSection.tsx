import { CalendarClock, CalendarRange, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import { MetricCard } from '@/components/shared/MetricCard';
import { MetricGrid } from '@/components/shared/MetricGrid';

import { LabRow, LabSection } from './LabSection';

function Kpis({ loading = false }: { loading?: boolean }) {
  return (
    <>
      <MetricCard title="Ingresos totales" value="$12,480.00" description="Suma de todas las ventas" icon={TrendingUp} loading={loading} />
      <MetricCard title="Gastos totales" value="$4,210.50" description="Gastos registrados" icon={TrendingDown} loading={loading} />
      <MetricCard title="Ganancias" value="$8,269.50" valueTone="success" description="Ingresos menos gastos" icon={Wallet} loading={loading} />
      <MetricCard title="Gastos esperados" value="$1,120.00" description="A pagar este mes" icon={CalendarClock} loading={loading} />
      <MetricCard title="Ingresos esperados" value="$2,340.00" description="A recibir este mes" icon={CalendarRange} loading={loading} />
    </>
  );
}

export function MetricsSection() {
  return (
    <LabSection id="metricas" title="Métricas" description="Datos sintéticos. La franja (strip) agrupa KPIs sin cinco cajas de colores.">
      <div className="space-y-5">
        <LabRow label="MetricGrid · strip (propuesto para el dashboard)">
          <MetricGrid variant="strip" className="w-full">
            <Kpis />
          </MetricGrid>
        </LabRow>
        <LabRow label="MetricGrid · cards">
          <MetricGrid variant="cards" className="w-full">
            <MetricCard title="En proceso" value={12} icon={TrendingUp} tone="info" />
            <MetricCard title="Próximos a finalizar" value={3} icon={CalendarClock} tone="warning" />
            <MetricCard title="Vencidos" value={2} icon={TrendingDown} tone="danger" />
          </MetricGrid>
        </LabRow>
        <LabRow label="Cargando (misma altura que cargado)">
          <MetricGrid variant="strip" className="w-full">
            <Kpis loading />
          </MetricGrid>
        </LabRow>
      </div>
    </LabSection>
  );
}
