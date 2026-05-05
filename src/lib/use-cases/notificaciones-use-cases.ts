import { queryNotificaciones } from '@/lib/supabase/notifications-repository';
import type { QueryFilter } from '@/lib/supabase/entities';
import type { Notificacion } from '@/types';

export function fetchNotificacionesByFiltersUseCase<T = Notificacion>(filters: QueryFilter[] = []) {
  return queryNotificaciones<T>(filters);
}
