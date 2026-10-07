'use client';

import { ReportsView } from '@/components/customer-reports/ReportsView';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { useAuthStore } from '@/store/authStore';

export default function ReportsPage() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  return <ModuleErrorBoundary moduleName="Reportes"><ReportsView enabled={admin} /></ModuleErrorBoundary>;
}
