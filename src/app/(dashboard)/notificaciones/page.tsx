/**
 * Notificaciones Page
 *
 * Displays notification tables with optimized queries
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Bell, ShoppingCart, Server, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { VentasProximasTable } from '@/components/notificaciones/VentasProximasTable';
import { ServiciosProximosTable } from '@/components/notificaciones/ServiciosProximosTable';
import { ReposoNotificacionesTable } from '@/components/notificaciones/ReposoNotificacionesTable';
import { MetricCard } from '@/components/shared/MetricCard';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { esNotificacionServicio } from '@/types/notificaciones';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import {
  sincronizarNotificaciones,
  sincronizarNotificacionesForzado,
} from '@/lib/services/notificationSyncService';
import { toast } from 'sonner';

// Metrics component matching CategoriasMetrics style
function NotificacionesMetrics() {
  const { totalNotificaciones, ventasProximas, serviciosProximos, reposoCompletados } =
    useNotificacionesStore();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
    </div>
  );
}

function NotificacionesPageContent() {
  const { notificaciones, fetchNotificaciones, fetchCounts, ventasProximas, serviciosProximos, reposoCompletados } =
    useNotificacionesStore();
  const fetchTemplates = useTemplatesStore((state) => state.fetchTemplates);

  const [activeTab, setActiveTab] = useState('ventas');
  const [isSyncing, setIsSyncing] = useState(false);
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
        await Promise.all([
          fetchNotificaciones(true),
          fetchCounts(),
          fetchTemplates(true),
        ]);
      } catch (error) {
        console.error('Error initializing notifications:', error);
        toast.error('Error al cargar notificaciones', { description: 'No se pudieron obtener las notificaciones. Intenta nuevamente.' });
      }
    };

    init();
  }, [fetchNotificaciones, fetchCounts, fetchTemplates]);

  /**
   * Manual sync trigger
   */
  const handleForzarSync = async () => {
    setIsSyncing(true);
    try {
      await sincronizarNotificacionesForzado();
      await Promise.all([
        fetchNotificaciones(true),
        fetchCounts(),
        fetchTemplates(true),
      ]);
      toast.success('Sincronización completada', { description: 'Las notificaciones han sido actualizadas correctamente.' });
    } catch (error) {
      console.error('Error during sync:', error);
      toast.error('Error durante sincronización', { description: 'No se pudo completar la sincronización. Intenta nuevamente.' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notificaciones</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            / <span className="text-foreground">Notificaciones</span>
          </p>
        </div>
        <Button onClick={handleForzarSync} disabled={isSyncing} variant="outline" className="self-start sm:self-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sincronizando...' : 'Actualizar'}
        </Button>
      </div>

      {/* Metrics - matching CategoriasMetrics style */}
      <NotificacionesMetrics />

      {/* Tabs - matching Categorías tabs style */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-transparent rounded-none p-0 h-auto inline-flex w-fit max-w-full flex-wrap items-end justify-start gap-x-0 gap-y-1 overflow-visible border-b border-border">
          <TabsTrigger
            value="ventas"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm whitespace-nowrap"
          >
            Ventas Próximas
            {ventasProximas > 0 && (
              <span className="ml-2 text-xs bg-red-500 text-white rounded-full px-2 py-0.5">
                {ventasProximas}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="servicios"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm whitespace-nowrap"
          >
            Servicios Próximos
            {serviciosProximos > 0 && (
              <span className="ml-2 text-xs bg-red-500 text-white rounded-full px-2 py-0.5">
                {serviciosProximos}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="autorrenovables"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm whitespace-nowrap"
          >
            Servicios autorrenovables
            {serviciosAutorrenovables > 0 && (
              <span className="ml-2 text-xs bg-red-500 text-white rounded-full px-2 py-0.5">
                {serviciosAutorrenovables}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="reposo"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm whitespace-nowrap"
          >
            Servicios en Reposo
            {reposoCompletados > 0 && (
              <span className="ml-2 text-xs bg-red-500 text-white rounded-full px-2 py-0.5">
                {reposoCompletados}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Ventas Tab */}
        <TabsContent value="ventas" className="space-y-4">
          <VentasProximasTable />
        </TabsContent>

        {/* Servicios Tab */}
        <TabsContent value="servicios" className="space-y-4">
          <ServiciosProximosTable />
        </TabsContent>

        {/* Servicios Autorrenovables Tab */}
        <TabsContent value="autorrenovables" className="space-y-4">
          <ServiciosProximosTable
            soloAutorrenovables
            title="Servicios autorrenovables"
            emptyMessage="No se encontraron servicios autorrenovables proximos a vencer"
          />
        </TabsContent>

        {/* Servicios Reposo Tab */}
        <TabsContent value="reposo" className="space-y-4">
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
