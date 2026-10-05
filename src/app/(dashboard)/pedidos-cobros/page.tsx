'use client';

import { Suspense } from 'react';

import { CobrosMetrics, InteresadosMetrics, PedidosMetrics } from '@/components/pedidos-cobros/QueueMetrics';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { InterestsView } from '@/components/terceros/InterestsView';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PedidosView } from '@/components/ventas/PedidosView';
import { YappyPaymentsView } from '@/components/yappy/YappyPaymentsView';
import { useTabParam } from '@/hooks/use-tab-param';
import { useAuthStore } from '@/store/authStore';

const TABS = ['pedidos', 'cobros', 'interesados'] as const;

/**
 * Colas que produce la venta por WhatsApp. Cada pestaña muestra sus indicadores y su tabla; las inactivas se
 * desmontan, así que solo consulta la visible. Filtros y búsqueda sobreviven al cambio de pestaña (`useTableContext`).
 */
function PedidosCobrosContent() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  const [tab, setTab] = useTabParam(TABS, 'pedidos');
  if (!admin) return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;
  return (
    <div className="min-w-0 space-y-4">
      <PageHeader title="Pedidos y cobros" />
      <ModuleErrorBoundary moduleName="Indicadores">
        {tab === 'pedidos' ? <PedidosMetrics /> : tab === 'cobros' ? <CobrosMetrics /> : <InteresadosMetrics />}
      </ModuleErrorBoundary>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Secciones de pedidos y cobros">
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="cobros">Cobros</TabsTrigger>
          <TabsTrigger value="interesados">Interesados</TabsTrigger>
        </TabsList>
        <TabsContent value="pedidos" className="min-w-0">
          <ModuleErrorBoundary moduleName="Pedidos"><PedidosView /></ModuleErrorBoundary>
        </TabsContent>
        <TabsContent value="cobros" className="min-w-0">
          <ModuleErrorBoundary moduleName="Cobros"><YappyPaymentsView /></ModuleErrorBoundary>
        </TabsContent>
        <TabsContent value="interesados" className="min-w-0">
          <ModuleErrorBoundary moduleName="Interesados"><InterestsView /></ModuleErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PedidosCobrosPage() {
  return (
    <ModuleErrorBoundary moduleName="Pedidos y cobros">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PedidosCobrosContent />
      </Suspense>
    </ModuleErrorBoundary>
  );
}
