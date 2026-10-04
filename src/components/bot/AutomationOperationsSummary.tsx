'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAutomationControl } from '@/hooks/use-automation-control';
import { MetricGrid } from '@/components/shared/MetricGrid';
import { MetricCard } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';

export function AutomationOperationsSummary() {
  const query = useAutomationControl();
  const [details, setDetails] = useState(false);
  const operations = query.data?.operations;
  if (query.isError) return <div role="alert" className="flex flex-wrap items-center gap-2"><p className="text-sm text-danger">No se pudo consultar el resumen operativo.</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Reintentar resumen</Button></div>;
  if (!operations && !query.isLoading) return null;
  return <section className="space-y-2" aria-label="Resumen operativo">
    <MetricGrid variant="strip">
      <MetricCard title="Mensajes por revisar" value={operations?.reviewMessages ?? 0} loading={query.isLoading} valueTone={operations?.reviewMessages ? 'warning' : 'neutral'} description={`${operations?.pendingMessages ?? 0} mensajes pendientes`} />
      <MetricCard title="Pedidos de hoy completados" value={operations?.completedToday ?? 0} loading={query.isLoading} description={`${operations?.ordersToday ?? 0} pedidos creados hoy`} />
      <MetricCard title="Consultas IA hoy" value={operations?.aiCallsToday ?? 0} loading={query.isLoading} description={`${operations?.aiReservedTokensToday ?? 0} tokens de presupuesto reservado`} />
    </MetricGrid>
    {operations ? <>
      <Button variant="ghost" size="sm" aria-expanded={details} aria-controls="automation-operations-details" onClick={() => setDetails(value => !value)}>{details ? 'Ocultar detalle operativo' : 'Ver detalle operativo'}</Button>
      {details ? <div id="automation-operations-details" className="space-y-2 text-sm text-muted-foreground"><p>{operations.pendingDeliveries} entregas pendientes · {operations.reviewDeliveries} entregas por revisar · {operations.retryAttempts} intentos de reenvío</p><p>Tiempo medio de resolución: {operations.averageResolutionSeconds.toFixed(0)} segundos{operations.oldestPendingAt ? ` · Pendiente más antiguo: ${new Date(operations.oldestPendingAt).toLocaleString('es-PA')}` : ''}</p><Button variant="outline" size="sm" asChild><Link href="/chats">Revisar casos en Chats</Link></Button>{operations.pendingInterests !== undefined || operations.reviewInterests !== undefined ? <div className="space-y-2"><p>Avisos de stock: {operations.pendingInterests ?? 'sin dato'} pendientes · {operations.reviewInterests ?? 'sin dato'} por revisar</p><Button variant="outline" size="sm" asChild><Link href="/automatizaciones/interesados">Revisar avisos en Interesados</Link></Button></div> : null}</div> : null}
    </> : null}
  </section>;
}
