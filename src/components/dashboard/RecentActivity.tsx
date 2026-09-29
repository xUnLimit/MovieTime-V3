'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Panel } from '@/components/shared/Panel';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { getActivityDisplayConfig } from '@/platform/utils/activityDisplayHelpers';
import { useDashboardHome } from '@/hooks/use-dashboard-home';

const VISIBLE_ACTIVITY = 5;

// Las filas se reparten el alto disponible por igual; el mensaje admite hasta 2 lineas.
const LIST_CLASS = 'flex h-full min-h-0 flex-col divide-y divide-border overflow-y-auto';
const ROW_CLASS = 'flex min-h-11 flex-1 items-center gap-2.5 py-1.5';

function formatRelative(timestamp: string | Date | undefined | null) {
  if (!timestamp) return 'Fecha desconocida';
  return `hace ${formatDistanceToNow(new Date(timestamp), { locale: es }).replace('alrededor de ', '')}`;
}

export function RecentActivity() {
  const { data: dashboardHome, isLoading } = useDashboardHome();
  const recentLogs = dashboardHome?.recentActivity ?? [];

  return (
    <Panel
      title="Actividad Reciente"
      description="Un vistazo a las últimas acciones realizadas."
      className="md:h-[324px] lg:h-auto lg:min-h-0"
      contentClassName="min-h-[240px]"
      fill
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link prefetch={false} href="/log-actividad">
            Ver todo
          </Link>
        </Button>
      }
    >
      {isLoading ? (
        <ul className={LIST_CLASS} aria-busy="true">
          {Array.from({ length: VISIBLE_ACTIVITY }, (_, i) => (
            <li key={i} className={ROW_CLASS}>
              <Skeleton className="size-6 shrink-0 rounded-md" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-14 shrink-0" />
            </li>
          ))}
        </ul>
      ) : recentLogs.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No hay actividad reciente</p>
      ) : (
        <ul className={LIST_CLASS}>
          {recentLogs.slice(0, VISIBLE_ACTIVITY).map((log) => {
            const { icon: Icon, color, message } = getActivityDisplayConfig(log);
            const [bgColor, textColor] = color.split(' ');

            return (
              <li key={log.id} className={ROW_CLASS}>
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${bgColor}`}>
                  <Icon className={`size-3 ${textColor}`} />
                </span>
                <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                  <p className="line-clamp-2 min-w-0 text-sm leading-snug">{message}</p>
                  <p className="shrink-0 pt-0.5 text-xs whitespace-nowrap text-muted-foreground">
                    {formatRelative(log.timestamp)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
