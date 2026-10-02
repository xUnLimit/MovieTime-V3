import { createServiceRoleClient } from '@/platform/server/supabase-server';
import type { RawDomainEvent } from './event-schemas';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export type DomainEventStore = {
  claim(limit: number, lockSeconds: number): Promise<RawDomainEvent[]>;
  // errorLabel null = procesado; una etiqueta libera el evento para otro intento.
  finish(id: string, errorLabel: string | null): Promise<void>;
};

function check(error: { code?: string } | null, operation: string): void {
  if (error) throw new Error(`Domain event store ${operation} failed: ${error.code ?? 'unknown'}`);
}

export function createDomainEventStore(client: ServiceClient = createServiceRoleClient()): DomainEventStore {
  return {
    async claim(limit, lockSeconds) {
      const { data, error } = await client.rpc('claim_domain_events', { p_limit: limit, p_lock_seconds: lockSeconds });
      check(error, 'claim');
      return (data ?? []).map((row) => ({
        id: row.id, type: row.type, aggregateType: row.aggregate_type, aggregateId: row.aggregate_id,
        payload: row.payload, occurredAt: row.occurred_at, attempts: row.attempts,
      }));
    },
    async finish(id, errorLabel) {
      const { error } = await client.rpc('finish_domain_event', { p_id: id, p_error: errorLabel });
      check(error, 'finish');
    },
  };
}
