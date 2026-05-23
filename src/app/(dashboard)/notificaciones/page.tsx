/**
 * Notificaciones Page
 *
 * Displays notification tables with optimized queries
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Banknote, Bell, Pause, Server, ShoppingCart } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { VentasProximasTable } from '@/components/notificaciones/VentasProximasTable';
import { ServiciosProximosTable } from '@/components/notificaciones/ServiciosProximosTable';
import { ReposoNotificacionesTable } from '@/components/notificaciones/ReposoNotificacionesTable';
import { MetricCard } from '@/components/shared/MetricCard';
import { useNotificacionesMontos } from '@/hooks/use-notificaciones-montos';
import { useNotificaciones } from '@/hooks/use-notificaciones';
import { queryKeys } from '@/lib/query-keys';
import { esNotificacionServicio } from '@/types/notificaciones';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { sincronizarNotificaciones } from '@/lib/notifications';
import { toast } from 'sonner';

// Metrics component matching CategoriasMetrics style
function NotificacionesMetrics() {
  const { data: notificaciones = [] } = useNotificaciones();
  const totalNotificaciones = notificaciones.length;
  const ventasProximas = notificaciones.filter((notificacion) => notificacion.entidad === 'venta').length;
  const serviciosProximos = notificaciones.filter((notificacion) => notificacion.entidad === 'servicio').length;
  const reposoCompletados = notificaciones.filter((notificacion) => notificacion.entidad === 'reposo').length;
  const {
    ventasEnRetraso,
    serviciosPorPagar,
    isLoading: loadingMontos,
  } = useNotificacionesMontos();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <MetricCard
        title="Total Notificaciones"
        value={totalNotificaciones}
        icon={Bell}
        iconColor="text-blue-500"
        underlineColor="bg-blue-500"
      />
      <MetricCard
        title="Ventas Próximas"
        value={ventasProximas}
        icon={ShoppingCart}
        iconColor="text-red-500"
        underlineColor="bg-red-500"
      />
      <MetricCard
        title="Servicios Próximos"
        value={serviciosProximos}
        icon={Server}
        iconColor="text-orange-500"
        underlineColor="bg-orange-500"
      />
      <MetricCard
        title="Servicios en Reposo"
        value={reposoCompletados}
        icon={Pause}
        iconColor="text-purple-500"
        underlineColor="bg-purple-500"
      />
      <MetricCard
        title="Monto Ventas en Retraso"
        value={ventasEnRetraso != null ? `$${ventasEnRetraso.toFixed(2)}` : '$0.00'}
        icon={AlertTriangle}
        iconColor="text-red-600"
        underlineColor="bg-red-600"
        loading={loadingMontos}
      />
      <MetricCard
        title="Monto Servicios en Retraso"
        value={serviciosPorPagar != null ? `$${serviciosPorPagar.toFixed(2)}` : '$0.00'}
        icon={Banknote}
        iconColor="text-emerald-500"
        underlineColor="bg-emerald-500"
        loading={loadingMontos}
      />
    </div>
  );
}

function NotificacionesPageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: notificaciones = [] } = useNotificaciones();
  const ventasProximas = notificaciones.filter((notificacion) => notificacion.entidad === 'venta').length;
  const serviciosProximos = notificaciones.filter((notificacion) => notificacion.entidad === 'servicio').length;
  const reposoCompletados = notificaciones.filter((notificacion) => notificacion.entidad === 'reposo').length;

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'ventas');
  const serviciosAutorrenovables = useMemo(
    () =>
      notificaciones.filter(
        (notificacion) =>
          esNotificacionServicio(notificacion) &&
          notificacion.renovacionAutomatica === true
      ).length,
    [notificaciones]
  );

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      try {
        await sincronizarNotificaciones();
        await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
      } catch (error) {
        console.error('Error initializing notifications:', error);
        toast.error('Error al cargar notificaciones', { description: 'No se pudieron obtener las notificaciones. Intenta nuevamente.' });
      }
    };

    init();
  }, [queryClient]);

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notificaciones</h1>
          <p className="text-sm text-muted-foreground">
            <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            / <span className="text-foreground">Notificaciones</span>
          </p>
        </div>
      </div>

      {/* Metrics - matching CategoriasMetrics style */}
      <NotificacionesMetrics />

      {/* Tabs - matching Categorías tabs style */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
        <div className="tabs-scroll-shell -mx-1 px-1">
          <TabsList className="tabs-scroll-list h-auto rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="ventas"
            className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs whitespace-nowrap data-[state=active]:border-primary data-[state=active]:bg-transparent sm:px-4 sm:text-sm"
          >
            Ventas Próximas
            {ventasProximas > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white sm:ml-2 sm:px-2 sm:text-xs">
                {ventasProximas}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="servicios"
            className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs whitespace-nowrap data-[state=active]:border-primary data-[state=active]:bg-transparent sm:px-4 sm:text-sm"
          >
            Servicios Próximos
            {serviciosProximos > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white sm:ml-2 sm:px-2 sm:text-xs">
                {serviciosProximos}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="autorrenovables"
            className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs whitespace-nowrap data-[state=active]:border-primary data-[state=active]:bg-transparent sm:px-4 sm:text-sm"
          >
            Servicios autorrenovables
            {serviciosAutorrenovables > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white sm:ml-2 sm:px-2 sm:text-xs">
                {serviciosAutorrenovables}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="reposo"
            className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs whitespace-nowrap data-[state=active]:border-primary data-[state=active]:bg-transparent sm:px-4 sm:text-sm"
          >
            Servicios en Reposo
            {reposoCompletados > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white sm:ml-2 sm:px-2 sm:text-xs">
                {reposoCompletados}
              </span>
            )}
          </TabsTrigger>
          </TabsList>
        </div>

        {/* Ventas Tab */}
        <TabsContent value="ventas" className="min-w-0 space-y-4">
          <VentasProximasTable />
        </TabsContent>

        {/* Servicios Tab */}
        <TabsContent value="servicios" className="min-w-0 space-y-4">
          <ServiciosProximosTable />
        </TabsContent>

        {/* Servicios Autorrenovables Tab */}
        <TabsContent value="autorrenovables" className="min-w-0 space-y-4">
          <ServiciosProximosTable
            soloAutorrenovables
            title="Servicios autorrenovables"
            emptyMessage="No se encontraron servicios autorrenovables proximos a vencer"
          />
        </TabsContent>

        {/* Servicios Reposo Tab */}
        <TabsContent value="reposo" className="min-w-0 space-y-4">
          <ReposoNotificacionesTable />
        </TabsContent>
      </Tabs>

    </div>
  );
}

export default function NotificacionesPage() {
  return (
    <ModuleErrorBoundary moduleName="Notificaciones">
      <NotificacionesPageContent />
    </ModuleErrorBoundary>
  );
}
