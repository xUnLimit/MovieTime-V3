'use client';

import type { QueryClient } from '@tanstack/react-query';

import DashboardPage from '@/app/(dashboard)/dashboard/page';
import { queryKeys } from '@/platform/query-keys';

import { ShellPreview } from '../shell/ShellPreview';
import { DEMO_COUNTS, buildDemoActivity, buildDemoStats } from '../demo-dashboard-data';

function seedDashboard(queryClient: QueryClient) {
  const stats = buildDemoStats();
  queryClient.setQueryData(queryKeys.dashboard.home(), {
    stats,
    counts: DEMO_COUNTS,
    recentActivity: buildDemoActivity(),
  });
  queryClient.setQueryData(queryKeys.dashboard.stats(), stats);
}

/** El Dashboard real dentro del shell real, alimentado con datos sinteticos. */
export function DashboardPreview() {
  return (
    <ShellPreview seed={seedDashboard}>
      <DashboardPage />
    </ShellPreview>
  );
}
