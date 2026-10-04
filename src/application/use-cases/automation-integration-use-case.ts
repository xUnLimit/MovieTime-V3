import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { z } from '@/platform/validation/zod';

export const integrationCommandSchema = z.discriminatedUnion('command', [
  z.object({ command: z.literal('poll'), consumer: z.literal('demand-summary') }).strict(),
  z.object({ command: z.literal('acknowledge'), consumer: z.literal('demand-summary'),
    eventId: z.string().uuid(), token: z.string().uuid() }).strict(),
]);
const exportedEventSchema = z.object({
  id: z.string().uuid(), token: z.string().uuid(), version: z.literal(1),
  correlationId: z.string().uuid().nullable(),
  type: z.enum(['pedido.confirmado', 'pedido.pagado', 'pedido.asignado', 'access.mode_changed', 'demand.registered']),
  aggregateId: z.string().max(128), occurredAt: z.string().max(40),
  data: z.object({ state: z.string().max(80).optional(), amount: z.number().optional(),
    currency: z.string().max(10).optional(), categoryId: z.string().max(128).optional() }).strict(),
}).strict();

export async function executeIntegrationUseCase(command: z.infer<typeof integrationCommandSchema>) {
  const client = createServiceRoleClient();
  if (command.command === 'poll') {
    const { data, error } = await client.rpc('mt_export_integration_events', { p_consumer: command.consumer });
    if (error) throw new Error('No se pudieron obtener los eventos.', { cause: error });
    return z.array(exportedEventSchema).max(25).parse(data);
  }
  const { data, error } = await client.rpc('mt_ack_integration_event', {
    p_consumer: command.consumer, p_event_id: command.eventId, p_token: command.token,
  });
  if (error) throw new Error('No se pudo registrar la recepción.', { cause: error });
  return { acknowledged: data === true };
}
