import { Panel } from "@/components/shared/Panel";
import { Skeleton } from "@/components/ui/skeleton";

export function IngresosVsGastosChartSkeleton() {
  return (
    <Panel
      title="Ingresos vs Gastos"
      description="Comparativa diaria de ingresos por ventas y gastos del mes actual."
      className="h-full"
      actions={<Skeleton className="h-8 w-[168px] rounded-md" />}
    >
      <Skeleton className="h-[240px] w-full rounded-lg" />
    </Panel>
  );
}

export function CrecimientoTercerosSkeleton() {
  return (
    <Panel
      title="Terceros Nuevos"
      description="Clientes y revendedores nuevos por día en el mes actual."
      className="md:h-[324px] lg:h-auto lg:min-h-0"
      contentClassName="min-h-[240px] md:min-h-[200px]"
      fill
      actions={<Skeleton className="h-8 w-[150px] rounded-md" />}
    >
      <Skeleton className="h-full w-full rounded-lg" />
    </Panel>
  );
}

export function RevenueByCategorySkeleton() {
  return (
    <Panel
      title="Ganancia Neta por Categoría"
      description="Ganancia neta generada por cada categoría de servicio."
      className="md:h-[324px] lg:h-auto lg:min-h-0"
      contentClassName="min-h-[260px] md:min-h-[200px]"
      fill
    >
      <Skeleton className="h-full w-full rounded-lg" />
    </Panel>
  );
}
