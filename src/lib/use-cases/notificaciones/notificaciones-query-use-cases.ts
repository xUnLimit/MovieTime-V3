import {
  queryNotificationIdsRead,
  queryNotificationsRead,
} from '@/lib/supabase/domain-read-adapters';
import { countNotificaciones } from '@/lib/supabase/notifications-repository';
import type { QueryFilter } from '@/lib/supabase/entities';

export { queryNotificationIdsRead };

export function queryNotificationsUseCase(filters: QueryFilter[] = []) {
  return queryNotificationsRead(filters);
}

export async function fetchNotificationCountsUseCase() {
  const [totalNotificaciones, ventasProximas, serviciosProximas, reposoCompletados] =
    await Promise.all([
      countNotificaciones(),
      countNotificaciones([{ field: 'entidad', operator: '==', value: 'venta' }]),
      countNotificaciones([{ field: 'entidad', operator: '==', value: 'servicio' }]),
      countNotificaciones([{ field: 'entidad', operator: '==', value: 'reposo' }]),
    ]);

  return {
    reposoCompletados,
    serviciosProximos: serviciosProximas,
    totalNotificaciones,
    ventasProximas,
  };
}
