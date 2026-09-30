import { queryNotificationsRead, type NotificacionConId } from '@/platform/supabase/domain-read-adapters';
import type { QueryFilter } from '@/platform/supabase/entities';

export type { NotificacionConId };

export function queryNotificationsUseCase(filters: QueryFilter[] = []) {
  return queryNotificationsRead(filters);
}
