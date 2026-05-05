"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, CalendarDays, Users } from "lucide-react";
import { Servicio } from "@/types";
import { calcularDiasRelativosCalendario } from "@/lib/utils/calculations";

interface ServicioDetailMetricsProps {
  servicios: Servicio[];
}

export function ServicioDetailMetrics({
  servicios,
}: ServicioDetailMetricsProps) {
  const serviciosActivos = servicios.filter((s) => s.activo);
  const totalPerfiles = servicios.reduce(
    (sum, s) => sum + s.perfilesDisponibles,
    0,
  );
  const perfilesOcupados = servicios.reduce(
    (sum, s) => sum + (s.perfilesOcupados || 0),
    0,
  );
  const perfilesDisponibles = totalPerfiles - perfilesOcupados;

  // Calcular próximos pagos (servicios con 7 días restantes o menos)
  const proximosPagos = servicios.filter((s) => {
    const diffDias = calcularDiasRelativosCalendario(s.fechaVencimiento);
    if (diffDias === null) return false;
    return diffDias >= 0 && diffDias <= 7;
  }).length;

  const metrics = [
    {
      title: "Servicios Activos",
      value: `${serviciosActivos.length}/${servicios.length}`,
      icon: Monitor,
      color: "text-blue-600",
    },
    {
      title: "Próximos Pagos (7 días)",
      value: proximosPagos.toString(),
      icon: CalendarDays,
      color: "text-yellow-600",
    },
    {
      title: "Perfiles",
      value: `${perfilesDisponibles}/${totalPerfiles} disponibles`,
      icon: Users,
      color: "text-green-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <Icon className={`h-5 w-5 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
