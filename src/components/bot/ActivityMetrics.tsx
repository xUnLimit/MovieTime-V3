'use client';

import Link from 'next/link';
import { MetricCard } from '@/components/shared/MetricCard';
import { MetricGrid } from '@/components/shared/MetricGrid';
import { Button } from '@/components/ui/button';
import { useAutomationControl } from '@/hooks/use-automation-control';
import type { BotAdminApi } from '@/types/bot';

/** Segundos como "48 s" o "2 min 5 s". */
function duration(seconds: number): string {
  const total = Math.round(seconds);
  return total < 60 ? `${total} s` : `${Math.floor(total / 60)} min ${total % 60} s`;
}

/**
 * Indicadores del bot: eventos y códigos de las últimas 24 h y el procesamiento de los mensajes recibidos (casos por
 * revisar, pendientes, reintentos). El resumen operativo es otra consulta: si falla, la tabla de actividad sigue visible.
 */
export function ActivityMetrics({ api }: { api: BotAdminApi }) {
  const control = useAutomationControl();
  const operations = control.data?.operations;
  return <div className="space-y-3">
    <MetricGrid>
      <MetricCard title="Eventos en 24 h" value={api.health?.eventsLast24h ?? 0} />
      <MetricCard title="Códigos en 24 h" value={api.health?.codesLast24h ?? 0} />
      {operations ? <>
        <MetricCard title="Mensajes por revisar" value={operations.reviewMessages} valueTone={operations.reviewMessages ? 'warning' : 'neutral'} description={`${operations.pendingMessages} mensajes pendientes`} />
        <MetricCard title="Tiempo medio de resolución" value={duration(operations.averageResolutionSeconds)} description={`${operations.retryAttempts} ${operations.retryAttempts === 1 ? 'reintento' : 'reintentos'}`} />
      </> : control.isLoading ? <MetricCard title="Mensajes por revisar" value={0} loading /> : null}
    </MetricGrid>
    {operations ? <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span>{operations.oldestPendingAt ? `Pendiente más antiguo: ${new Date(operations.oldestPendingAt).toLocaleString('es-PA')}` : 'No hay mensajes pendientes'}</span>
      <Button variant="outline" size="sm" asChild><Link href="/chats">Revisar casos en Chats</Link></Button>
    </div> : null}
    {control.isError ? <div role="alert" className="flex flex-wrap items-center gap-2">
      <p className="text-sm text-danger">No se pudo consultar el resumen operativo.</p>
      <Button variant="outline" size="sm" onClick={() => void control.refetch()}>Reintentar resumen</Button>
    </div> : null}
  </div>;
}
