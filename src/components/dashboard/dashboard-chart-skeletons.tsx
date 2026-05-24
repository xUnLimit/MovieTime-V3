import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function IngresosVsGastosChartSkeleton() {
  return (
    <Card className="py-3 gap-0">
      <CardHeader className="flex flex-col gap-2 p-0 px-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Ingresos vs Gastos</CardTitle>
          <CardDescription className="text-sm hidden sm:block">
            Comparativa diaria de ingresos por ventas y gastos del mes actual.
          </CardDescription>
        </div>
        <Skeleton className="h-8 w-full sm:w-[140px] rounded-md" />
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-1">
        <Skeleton className="w-full h-[320px] rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function CrecimientoTercerosSkeleton() {
  return (
    <Card className="py-1">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pt-3 pb-2 px-6">
        <div className="space-y-0.5">
          <CardTitle className="text-base">Terceros Nuevos</CardTitle>
          <CardDescription className="text-sm">
            Clientes y revendedores nuevos por día en el mes actual.
          </CardDescription>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Skeleton className="h-7 w-[140px] rounded-md" />
          <span className="text-[11px] tabular-nums text-muted-foreground px-1">1/3</span>
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-6 pb-2">
        <Skeleton className="w-full h-[240px] rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function RevenueByCategorySkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">Ganancia Neta por Categoría</CardTitle>
            <CardDescription className="text-sm">
              Ganancia neta generada por cada categoría de servicio.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] tabular-nums text-muted-foreground px-1">1/2</span>
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1 h-[220px]">
        <Skeleton className="w-full h-full rounded-lg" />
      </CardContent>
    </Card>
  );
}
