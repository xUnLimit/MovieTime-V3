'use client';

import dynamic from 'next/dynamic';

import {
  CrecimientoTercerosSkeleton,
  IngresosVsGastosChartSkeleton,
  RevenueByCategorySkeleton,
} from '@/components/dashboard/dashboard-chart-skeletons';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { PronosticoFinanciero } from '@/components/dashboard/PronosticoFinanciero';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { NotificationBell } from '@/components/notificaciones/NotificationBell';
import { useDashboardNotificationToast } from './useDashboardNotificationToast';

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

export default function DashboardPage() {
  useDashboardNotificationToast();

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
          <NotificationBell />
        </div>
      </div>

      <DashboardMetrics />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-stretch">
        <div className="md:col-span-2 lg:col-span-3 flex flex-col">
          <IngresosVsGastosChart />
        </div>
        <div className="md:col-span-2 lg:col-span-1 flex flex-col">
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
