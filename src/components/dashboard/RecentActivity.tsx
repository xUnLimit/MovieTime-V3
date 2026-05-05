'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { useDashboardStore } from '@/store/dashboardStore';
import { getActivityDisplayConfig } from '@/lib/utils/activityDisplayHelpers';

export function RecentActivity() {
  const { recentActivity, isLoading } = useDashboardStore();
  const recentLogs = recentActivity;

  return (
    <Card className="flex flex-col py-1">
      {/* py-1 = padding vertical del Card (4px arriba + 4px abajo, igual que Ingresos por Categoría) */}
      {/* flex flex-col = layout vertical para organizar contenido */}
      <CardHeader className="pt-3 px-6 pb-2">
        {/* pt-3 = padding arriba del título (12px, igual que Ingresos por Categoría) */}
        {/* px-6 = separación del borde (24px) */}
        {/* pb-2 = espacio entre título y contenido (8px, igual que Ingresos por Categoría) */}
        <div className="space-y-0.5">
          {/* space-y-0.5 = espacio mínimo entre título y descripción (2px) */}
          <CardTitle className="text-base">Actividad Reciente</CardTitle>
          <CardDescription className="text-sm">
            Un vistazo a las últimas acciones realizadas.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="-mt-4 pt-0 px-6 pb-2 flex-1 flex flex-col">
        {/* -mt-4 = margen negativo arriba para subir actividades (16px hacia arriba) */}
        {/* pt-0 = sin espacio arriba */}
        {/* px-6 = separación del borde (24px) */}
        {/* pb-2 = espacio abajo (8px) */}
        {/* flex-1 = ocupa todo el espacio vertical disponible */}
        {/* flex flex-col = layout en columna (actividades arriba, botón abajo) */}
        <div className="space-y-1.5 pt-0">
          {/* space-y-1.5 = espacio vertical entre elementos (6px) */}
          {isLoading ? (
            <div className="w-full space-y-1.5 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <div className="flex-shrink-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/50" />
                  </div>
                  <div className="flex-1 space-y-0 min-w-0">
                    <p className="text-sm leading-tight rounded bg-muted/50">&nbsp;</p>
                    <p className="text-xs rounded bg-muted/50 w-20">&nbsp;</p>
                  </div>
                </div>
              ))}
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground text-center">No hay actividad reciente</p>
            </div>
          ) : (
            <div className="w-full space-y-1.5">
            {recentLogs.map((log) => {
              const { icon: Icon, color, message } = getActivityDisplayConfig(log);
              const [bgColor, textColor] = color.split(' ');

              return (
                <div key={log.id} className="flex items-start gap-1.5">
                  <div className="flex-shrink-0">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full ${bgColor}`}>
                      <Icon className={`h-3.5 w-3.5 ${textColor}`} />
                    </div>
                  </div>
                  <div className="flex-1 space-y-0 min-w-0">
                    <p className="text-sm leading-tight">{message}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.timestamp
                        ? `hace ${formatDistanceToNow(new Date(log.timestamp), { locale: es }).replace('alrededor de ', '')}`
                        : 'Fecha desconocida'}
                    </p>
                  </div>
                </div>
              );
            })
            }
            </div>
          )}
        </div>
        <div className="pt-6">
          <Button className="w-full bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700" asChild>
            <Link href="/log-actividad">
              Ver todo el historial
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
