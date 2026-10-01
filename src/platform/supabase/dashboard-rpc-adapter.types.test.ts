import { expectTypeOf, it } from 'vitest';

import type { Database } from './database.types';
import { getDashboardHomeRpc, getDashboardStatsSnapshotRpc } from './dashboard-rpc-adapter';

type Functions = Database['public']['Functions'];

it('conserva los argumentos generados del dashboard', () => {
  expectTypeOf<Parameters<typeof getDashboardHomeRpc>>().toEqualTypeOf<[]>();
  expectTypeOf<Parameters<typeof getDashboardStatsSnapshotRpc>>().toEqualTypeOf<[]>();
  expectTypeOf<Functions['get_dashboard_home']['Args']>().toEqualTypeOf<never>();
  expectTypeOf<Functions['get_dashboard_stats_snapshot']['Args']>().toEqualTypeOf<never>();
});
