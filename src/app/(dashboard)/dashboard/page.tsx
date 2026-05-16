'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { PronosticoFinanciero } from '@/components/dashboard/PronosticoFinanciero';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Skeletons que usan los mismos componentes y clases exactas que cada chart real
function IngresosVsGastosChartSkeleton() {
  // Replica exacta del estado isLoading=true del componente real:
  // header y descripción se muestran con texto real, solo el chart es skeleton.
  return (
    <Card className="py-3 gap-0">
      <CardHeader className="flex flex-col gap-2 p-0 px-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Ingresos vs Gastos</CardTitle>
          <CardDescription className="text-sm hidden sm:block">
            Comparativa diaria de ingresos por ventas y gastos del mes actual.
          </CardDescription>
        </div>
        <Skeleton className="h-8 w-full sm:w-[140px] rounded-md" />
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-1">
        <Skeleton className="w-full h-[320px] rounded-lg" />
      </CardContent>
    </Card>
  );
}

function CrecimientoTercerosSkeleton() {
  // Replica exacta del estado isLoading=true del componente real:
  // header y descripción con texto real, solo el chart es skeleton.
  return (
    <Card className="py-1">
      <CardHeader className="flex flex-row items-center justify-between pt-3 pb-2 px-6">
        <div className="space-y-0.5">
          <CardTitle className="text-base">Nuevos Terceros</CardTitle>
          <CardDescription className="text-sm">
            Clientes y revendedores nuevos por día en el mes actual.
          </CardDescription>
        </div>
        <Skeleton className="h-7 w-[140px] rounded-md" />
      </CardHeader>
      <CardContent className="pt-0 px-6 pb-2">
        <Skeleton className="w-full h-[240px] rounded-lg" />
      </CardContent>
    </Card>
  );
}

function RevenueByCategorySkeleton() {
  // Replica exacta del estado isLoading=true del componente real:
  // header con título, descripción y controles de paginación; solo el chart es skeleton.
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">Ganancia Neta por Categoría</CardTitle>
            <CardDescription className="text-sm">
              Ganancia neta generada por cada categoría de servicio.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] tabular-nums text-muted-foreground px-1">1/2</span>
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1 h-[220px]">
        <Skeleton className="w-full h-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

const IngresosVsGastosChart = dynamic(
  () => import('@/components/dashboard/IngresosVsGastosChart').then(m => ({ default: m.IngresosVsGastosChart })),
  { loading: () => <IngresosVsGastosChartSkeleton />, ssr: false }
);
const CrecimientoTerceros = dynamic(
  () => import('@/components/dashboard/CrecimientoTerceros').then(m => ({ default: m.CrecimientoTerceros })),
  { loading: () => <CrecimientoTercerosSkeleton />, ssr: false }
);
const RevenueByCategory = dynamic(
  () => import('@/components/dashboard/RevenueByCategory').then(m => ({ default: m.RevenueByCategory })),
  { loading: () => <RevenueByCategorySkeleton />, ssr: false }
);
import { UserMenu } from '@/components/layout/UserMenu';
import { NotificationBell } from '@/components/notificaciones/NotificationBell';
import { useDashboardStore } from '@/store/dashboardStore';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useCategoriasStore } from '@/store/categoriasStore';
import { esNotificacionVenta, esNotificacionServicio } from '@/types/notificaciones';
import { Button } from '@/components/ui/button';
import { RefreshCw, Bell, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function DashboardPage() {
  const fetchDashboard = useDashboardStore((state) => state.fetchDashboard);
  const isRecalculating = useDashboardStore((state) => state.isRecalculating);
  const fetchNotificaciones = useNotificacionesStore((state) => state.fetchNotificaciones);
  const fetchCategorias = useCategoriasStore((state) => state.fetchCategorias);
  const toastShown = useRef(false);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Fetch notifications and show welcome toast on first visit
  useEffect(() => {
    const showWelcomeToast = async () => {
      await fetchNotificaciones();

      // Only show once per session
      if (toastShown.current || sessionStorage.getItem('dashboard-toast-shown')) return;
      toastShown.current = true;
      sessionStorage.setItem('dashboard-toast-shown', '1');

      const store = useNotificacionesStore.getState();
      const unread = store.notificaciones.filter((n) => !n.leida);
      if (unread.length === 0) return;

      const hasRed = unread.some((n) => n.prioridad === 'critica');
      const ventasCount = unread.filter(esNotificacionVenta).length;
      const serviciosCount = unread.filter(esNotificacionServicio).length;

      const isRed = hasRed;
      const parts: string[] = [];
      if (ventasCount > 0) parts.push(`${ventasCount} venta${ventasCount > 1 ? 's' : ''} por vencer`);
      if (serviciosCount > 0) parts.push(`${serviciosCount} servicio${serviciosCount > 1 ? 's' : ''} por pagar`);
      const description = parts.length > 0
        ? `Tienes ${parts.join(' y ')} que requieren tu atención.`
        : `Tienes ${unread.length} alerta${unread.length > 1 ? 's' : ''} importante${unread.length > 1 ? 's' : ''} que requieren tu atención.`;

      toast.custom((t) => (
        <div
          className={[
            'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg',
            'transition-all',
            isRed
              ? 'border-red-200 bg-background dark:border-red-500/30'
              : 'border-yellow-200 bg-background dark:border-yellow-500/30',
          ].join(' ')}
        >
          {/* Content */}
          <div className="grid gap-1">
            <div className={`text-sm font-semibold flex items-center gap-2 ${isRed ? 'text-red-500' : 'text-yellow-500'}`}>
              <Bell className="h-5 w-5" />
              ¡Notificaciones Pendientes!
            </div>
            <div className="text-sm opacity-90 text-foreground">
              {description}
            </div>
          </div>

          {/* Action button */}
          <Link prefetch={false}
            href="/notificaciones"
            onClick={() => toast.dismiss(t)}
            className={[
              'inline-flex h-8 shrink-0 items-center justify-center self-center rounded-md border bg-transparent px-3',
              'text-sm font-medium ring-offset-background transition-colors',
              'hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              isRed
                ? 'border-red-200 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900'
                : 'border-yellow-200 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-500/30 dark:text-yellow-300 dark:hover:bg-yellow-900',
            ].join(' ')}
          >
            Ver ahora
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>

          {/* Close button */}
          <button
            type="button"
            onClick={() => toast.dismiss(t)}
            className={[
              'absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity',
              'hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100',
              isRed
                ? 'text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-50 focus:ring-red-400'
                : 'text-yellow-600 hover:text-yellow-800',
            ].join(' ')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      ), {
        duration: 8000,
        unstyled: true,
        classNames: {
          toast: '!bg-transparent !border-0 !shadow-none !p-0 !rounded-none !gap-0 !flex-none w-full',
        },
      });
    };

    showWelcomeToast();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRecalculate = async () => {
    const toastId = toast.loading('Sincronizando sistema...');
    try {
      const { performGlobalSync } = await import('@/lib/services/centralSyncService');
      await performGlobalSync();

      // Refrescar stores locales para reflejar cambios
      const { useDashboardStore } = await import('@/store/dashboardStore');
      await useDashboardStore.getState().fetchDashboard(true);
      await fetchCategorias(true);

      toast.success('Sistema sincronizado correctamente', {
        id: toastId,
        description:
          'Notificaciones regeneradas y dashboard actualizado desde consultas SQL vivas.',
      });
    } catch (error) {
      console.error('Error during global sync:', error);
      toast.error('Error al sincronizar el sistema', { id: toastId });
    }
  };

  return (
    <div className="space-y-4 -mb-3 sm:-mb-4 md:-mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Vista general de métricas y rendimiento
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={isRecalculating}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRecalculating ? 'Sincronizando...' : 'Sincronizar sistema'}</span>
            <span className="sm:hidden">{isRecalculating ? '...' : 'Sincronizar'}</span>
          </Button>
          <NotificationBell />
          <UserMenu />
        </div>
      </div>

      <DashboardMetrics />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <div className="md:col-span-2 lg:col-span-3">
          <IngresosVsGastosChart />
        </div>
        <div className="md:col-span-2 lg:col-span-1">
          <PronosticoFinanciero />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <CrecimientoTerceros />
        <RevenueByCategory />
        <RecentActivity />
      </div>
    </div>
  );
}
