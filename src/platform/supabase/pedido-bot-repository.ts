import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { z } from '@/platform/validation/zod';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

const orderSchema = z.object({
  id: z.string().uuid(), tercero_id: z.string().nullable(), contact_id: z.string().nullable(),
  moneda: z.string().min(1).max(8), total: z.number(), pagado: z.number(), estado: z.string().max(32),
  expira_at: z.string(),
});
const settingsSchema = z.object({
  yappy_destino: z.string().max(120).nullable(), mensajes: z.record(z.string(), z.unknown()),
  recordatorio_activo: z.boolean(), recordatorio_horas: z.number().int().min(1).max(168),
});
const reminderSchema = z.array(z.object({
  pedido_id: z.string().uuid(), wa_id: z.string().min(1).max(64), total: z.number(), moneda: z.string(),
  expira_at: z.string(),
}));

export type BotOrder = {
  id: string; terceroId: string | null; contactId: string | null; moneda: string; total: number; paid: number;
  estado: string; expiraAt: string;
};
export type BotPaymentSettings = {
  yappyDestino: string | null; messages: Record<string, unknown>; reminderEnabled: boolean; reminderHours: number;
};
export type ReminderCandidate = { pedidoId: string; waId: string; total: number; moneda: string; expiraAt: string };
type ReminderOutcome = 'enviado' | 'fallido';

export type PedidoBotRepository = {
  findOrder(pedidoId: string): Promise<BotOrder | null>;
  loadSettings(): Promise<BotPaymentSettings>;
  claimReminders(limit: number): Promise<ReminderCandidate[]>;
  closeReminder(pedidoId: string, outcome: ReminderOutcome, reason: string | null): Promise<boolean>;
};

// Solo un codigo corto: los errores SQL no salen de este adaptador.
class PedidoBotRepositoryError extends Error {
  constructor(operation: string, readonly code: string) {
    super(`Pedido bot ${operation} failed: ${code}`);
    this.name = 'PedidoBotRepositoryError';
  }
}

export function createPedidoBotRepository(client: ServiceClient = createServiceRoleClient()): PedidoBotRepository {
  return {
    async findOrder(pedidoId) {
      const { data, error } = await client.rpc('obtener_pedido_para_bot', { p_pedido_id: pedidoId });
      if (error) throw new PedidoBotRepositoryError('findOrder', error.code ?? 'unknown');
      if (data === null) return null;
      const parsed = orderSchema.safeParse(data);
      if (!parsed.success) throw new PedidoBotRepositoryError('findOrder', 'invalid_response');
      const row = parsed.data;
      return {
        id: row.id, terceroId: row.tercero_id, contactId: row.contact_id, moneda: row.moneda, total: row.total,
        paid: row.pagado, estado: row.estado, expiraAt: row.expira_at,
      };
    },
    async loadSettings() {
      const { data, error } = await client.rpc('obtener_ajustes_pago_bot');
      if (error) throw new PedidoBotRepositoryError('loadSettings', error.code ?? 'unknown');
      const parsed = settingsSchema.safeParse(data);
      if (!parsed.success) throw new PedidoBotRepositoryError('loadSettings', 'invalid_response');
      return {
        yappyDestino: parsed.data.yappy_destino, messages: parsed.data.mensajes,
        reminderEnabled: parsed.data.recordatorio_activo, reminderHours: parsed.data.recordatorio_horas,
      };
    },
    async claimReminders(limit) {
      const { data, error } = await client.rpc('reclamar_recordatorios_pedido', { p_limit: limit });
      if (error) throw new PedidoBotRepositoryError('claimReminders', error.code ?? 'unknown');
      const parsed = reminderSchema.safeParse(data);
      if (!parsed.success) throw new PedidoBotRepositoryError('claimReminders', 'invalid_response');
      return parsed.data.map((row) => ({
        pedidoId: row.pedido_id, waId: row.wa_id, total: row.total, moneda: row.moneda, expiraAt: row.expira_at,
      }));
    },
    async closeReminder(pedidoId, outcome, reason) {
      const { data, error } = await client.rpc('cerrar_recordatorio_pedido',
        { p_pedido_id: pedidoId, p_estado: outcome, p_motivo: reason });
      if (error) throw new PedidoBotRepositoryError('closeReminder', error.code ?? 'unknown');
      return data === true;
    },
  };
}
