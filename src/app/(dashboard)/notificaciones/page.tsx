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
import { PageHeader } from '@/components/shared/PageHeader';
import { VentasProximasTable } from '@/components/notificaciones/VentasProximasTable';
import { ServiciosProximosTable } from '@/components/notificaciones/ServiciosProximosTable';
import { ReposoNotificacionesTable } from '@/components/notificaciones/ReposoNotificacionesTable';
import { MetricCard } from '@/components/shared/MetricCard';
import { MetricGrid } from '@/components/shared/MetricGrid';
import { useNotificacionesMontos } from '@/hooks/use-notificaciones-montos';
import { useNotificaciones } from '@/hooks/use-notificaciones';
import { applyNotificationQueryReactions } from '@/application/store-reactions/notification-query-reactions';
import { esNotificacionServicio } from '@/types/notificaciones';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { sincronizarNotificaciones } from '@/modules/notifications';
import { reportError } from '@/platform/observability/logger';
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
    <MetricGrid>
      <MetricCard
        title="Total Notificaciones"
        value={totalNotificaciones}
        icon={Bell}
        tone="info"
      />
      <MetricCard
        title="Ventas Próximas"
        value={ventasProximas}
        icon={ShoppingCart}
        tone="danger"
      />
      <MetricCard
        title="Servicios Próximos"
        value={serviciosProximos}
        icon={Server}
        tone="neutral"
      />
      <MetricCard
        title="Servicios en Reposo"
        value={reposoCompletados}
        icon={Pause}
        tone="neutral"
      />
      <MetricCard
        title="Monto Ventas en Retraso"
        value={ventasEnRetraso != null ? `$${ventasEnRetraso.toFixed(2)}` : '$0.00'}
        icon={AlertTriangle}
        tone="danger"
        loading={loadingMontos}
      />
      <MetricCard
        title="Monto Servicios en Retraso"
        value={serviciosPorPagar != null ? `$${serviciosPorPagar.toFixed(2)}` : '$0.00'}
        icon={Banknote}
        tone="success"
        loading={loadingMontos}
      />
    </MetricGrid>
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
        await applyNotificationQueryReactions(queryClient, {
          notificationInvalidationNeeded: true,
        });
      } catch (error) {
        reportError('NotificacionesPage', 'Error initializing notifications', error);
        toast.error('Error al cargar notificaciones', { description: 'No se pudieron obtener las notificaciones. Intenta nuevamente.' });
      }
    };

    init();
  }, [queryClient]);

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <PageHeader
        title="Notificaciones"
      />

      {/* Metrics - matching CategoriasMetrics style */}
      <NotificacionesMetrics />

      {/* Tabs - matching Categorías tabs style */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
        <TabsList>
          <TabsTrigger
            value="ventas" className="text-xs whitespace-nowrap sm:px-4 sm:text-sm"
          >
            Ventas Próximas
            {ventasProximas > 0 && (
              <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-xs text-danger-foreground sm:ml-2 sm:px-2 sm:text-xs">
                {ventasProximas}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="servicios" className="text-xs whitespace-nowrap sm:px-4 sm:text-sm"
          >
            Servicios Próximos
            {serviciosProximos > 0 && (
              <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-xs text-danger-foreground sm:ml-2 sm:px-2 sm:text-xs">
                {serviciosProximos}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="autorrenovables" className="text-xs whitespace-nowrap sm:px-4 sm:text-sm"
          >
            Servicios autorrenovables
            {serviciosAutorrenovables > 0 && (
              <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-xs text-danger-foreground sm:ml-2 sm:px-2 sm:text-xs">
                {serviciosAutorrenovables}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="reposo" className="text-xs whitespace-nowrap sm:px-4 sm:text-sm"
          >
            Servicios en Reposo
            {reposoCompletados > 0 && (
              <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-xs text-danger-foreground sm:ml-2 sm:px-2 sm:text-xs">
                {reposoCompletados}
              </span>
            )}
          </TabsTrigger>
          </TabsList>

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
