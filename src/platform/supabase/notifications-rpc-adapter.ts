import { assertOnlineMutation } from '@/modules/pwa/offline-copy';
import { assertRpcStringId } from '@/platform/utils/safety';

import { supabase } from './client';
import type { Database } from './database.types';

type NotificationRpcErrorShape = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export type NotificationAggregateRpcPayload =
  Database['public']['Functions']['upsert_notification_aggregate']['Args'];

export class NotificationAggregateRpcError extends Error {
  readonly code?: string;
  readonly details?: string;
  readonly hint?: string;

  constructor(error: NotificationRpcErrorShape) {
    const diagnostics = [
      error.code ? `code=${error.code}` : null,
      error.details ? `details=${error.details}` : null,
      error.hint ? `hint=${error.hint}` : null,
    ].filter(Boolean).join(' ');
    super(diagnostics ? `${error.message} (${diagnostics})` : error.message);
    this.name = 'NotificationAggregateRpcError';
    this.code = error.code;
    this.details = error.details;
    this.hint = error.hint;
  }
}

export async function upsertNotificationAggregateRpc(
  payload: NotificationAggregateRpcPayload,
): Promise<string> {
  assertOnlineMutation();
  const { data, error } = await supabase.rpc('upsert_notification_aggregate', payload);
  if (error) throw new NotificationAggregateRpcError(error);
  return assertRpcStringId(data, 'upsert_notification_aggregate');
}
