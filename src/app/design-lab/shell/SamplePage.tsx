'use client';

import { CalendarClock, CalendarRange, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import { MetricCard } from '@/components/shared/MetricCard';
import { MetricGrid } from '@/components/shared/MetricGrid';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';

/** Contenido sintetico para juzgar el shell: encabezado + KPIs. */
export function SamplePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Vista general de métricas y rendimiento"
        actions={
          <Button>
            <Plus /> Nueva venta
          </Button>
        }
      />
      <MetricGrid>
        <MetricCard title="Ingresos totales" value="$12,480.00" description="Suma de todas las ventas" icon={TrendingUp} />
        <MetricCard title="Gastos totales" value="$4,210.50" description="Gastos registrados" icon={TrendingDown} />
        <MetricCard title="Ganancias" value="$8,269.50" valueTone="success" description="Ingresos menos gastos" icon={Wallet} />
        <MetricCard title="Gastos esperados" value="$1,120.00" description="A pagar este mes" icon={CalendarClock} />
        <MetricCard title="Ingresos esperados" value="$2,340.00" description="A recibir este mes" icon={CalendarRange} />
      </MetricGrid>
    </div>
  );
}
