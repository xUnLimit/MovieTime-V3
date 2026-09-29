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
import { PageHeader } from '@/components/shared/PageHeader';
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
    <div className="flex flex-col gap-4 lg:grid lg:h-full lg:min-h-[840px] lg:grid-rows-[auto_auto_auto_minmax(0,1fr)]">
      <PageHeader
        title="Dashboard"
        description="Vista general de métricas y rendimiento"
        actions={<NotificationBell />}
      />

      <DashboardMetrics />

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col">
          <IngresosVsGastosChart />
        </div>
        <div className="flex min-w-0 flex-col">
          <PronosticoFinanciero />
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CrecimientoTerceros />
        <RevenueByCategory />
        <RecentActivity />
      </div>
    </div>
  );
}
