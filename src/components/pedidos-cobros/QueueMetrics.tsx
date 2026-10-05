'use client';

import { AlertTriangle, BellRing, CheckCircle2, Clock, Inbox, ShoppingBag, XCircle } from 'lucide-react';

import { MetricCard } from '@/components/shared/MetricCard';
import { MetricGrid } from '@/components/shared/MetricGrid';
import { Button } from '@/components/ui/button';
import { useAutomationControl } from '@/hooks/use-automation-control';
import { useYappyPayments } from '@/hooks/use-yappy-payments';

/**
 * Indicadores de cada cola de Pedidos y cobros, leídos del mismo resumen operativo (`useAutomationControl`).
 * Si el resumen aún no existe en el servidor no se muestra nada: una ausencia no se presenta como cero.
 */
export function PedidosMetrics() {
  const query = useAutomationControl();
  const operations = query.data?.operations;
  // El resumen es una consulta aparte: si falla, la tabla de pedidos sigue visible debajo.
  if (query.isError) return (
    <div role="alert" className="flex flex-wrap items-center gap-2">
      <p className="text-sm text-danger">No se pudo cargar el resumen de pedidos.</p>
      <Button variant="outline" onClick={() => void query.refetch()}>Reintentar resumen</Button>
    </div>
  );
  if (!operations && !query.isLoading) return null;
  const loading = query.isLoading;
  return (
    <MetricGrid>
      <MetricCard title="Pedidos de hoy" value={operations?.ordersToday ?? 0} icon={ShoppingBag} tone="info" loading={loading} />
      <MetricCard title="Completados hoy" value={operations?.completedToday ?? 0} icon={CheckCircle2} tone="success" loading={loading} />
      <MetricCard title="Entregas pendientes" value={operations?.pendingDeliveries ?? 0} icon={Clock} tone="info" loading={loading} />
      <MetricCard title="Entregas por revisar" value={operations?.reviewDeliveries ?? 0} icon={AlertTriangle} tone="warning" valueTone={operations?.reviewDeliveries ? 'warning' : undefined} loading={loading} />
    </MetricGrid>
  );
}

export function InteresadosMetrics() {
  const query = useAutomationControl();
  const operations = query.data?.operations;
  // La tabla de interesados usa la misma consulta y ya muestra el error con "Reintentar"; aquí no se repite.
  if (query.isError) return null;
  if (query.isLoading) return (
    <MetricGrid>
      <MetricCard title="Avisos pendientes" value={0} loading />
      <MetricCard title="Avisos por revisar" value={0} loading />
    </MetricGrid>
  );
  const pending = operations?.pendingInterests;
  const review = operations?.reviewInterests;
  // Cada contador es opcional en el servidor: solo se muestra el que existe.
  if (pending === undefined && review === undefined) return null;
  return (
    <MetricGrid>
      {pending === undefined ? null : <MetricCard title="Avisos pendientes" value={pending} icon={BellRing} tone="info" />}
      {review === undefined ? null : <MetricCard title="Avisos por revisar" value={review} icon={AlertTriangle} tone="warning" valueTone={review ? 'warning' : undefined} />}
    </MetricGrid>
  );
}

/** Indicadores de la cola de Cobros: pagos Yappy detectados por correo según su estado de conciliación. */
export function CobrosMetrics() {
  const payments = useYappyPayments();
  const all = payments.data ?? [];
  const count = (status: string) => all.filter(payment => payment.matchStatus === status).length;
  const pending = all.filter(payment => !['registrado', 'descartado'].includes(payment.matchStatus)).length;
  return (
    <MetricGrid>
      <MetricCard title="Detectados" value={all.length} icon={Inbox} tone="info" loading={payments.isLoading} />
      <MetricCard title="Por revisar" value={pending} icon={Clock} tone="warning" loading={payments.isLoading} />
      <MetricCard title="Registrados" value={count('registrado')} icon={CheckCircle2} tone="success" loading={payments.isLoading} />
      <MetricCard title="Descartados" value={count('descartado')} icon={XCircle} tone="danger" loading={payments.isLoading} />
    </MetricGrid>
  );
}
