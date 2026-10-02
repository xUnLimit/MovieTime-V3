import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { z } from '@/platform/validation/zod';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export const CLAIM_OUTCOMES = ['confirmado', 'monto_menor', 'monto_mayor', 'codigo_usado', 'no_encontrado',
  'fuera_de_ventana', 'pedido_invalido', 'intentos_excedidos'] as const;
export type ClaimOutcome = (typeof CLAIM_OUTCOMES)[number];

const claimSchema = z.object({
  resultado: z.enum(CLAIM_OUTCOMES),
  confirmado: z.boolean(),
  pedido_estado: z.string().max(32).optional(),
  total: z.number().optional(),
  pagado: z.number().optional(),
  faltante: z.number().optional(),
  entrega_pendiente: z.boolean().optional(),
  yappy_payment_id: z.string().uuid().optional(),
});
const pendingSchema = z.array(z.object({
  pedido_id: z.string().uuid(), wa_id: z.string().nullable(), codigo: z.string(),
}));

export type ClaimResult = {
  outcome: ClaimOutcome; confirmed: boolean; pedidoEstado: string | null; total: number; paid: number;
  remaining: number; deliveryPending: boolean;
};
export type ClaimInput = { pedidoId: string; code: string; waId: string | null; idempotencyKey: string; retry: boolean };
export type PendingReceipt = { pedidoId: string; waId: string | null; code: string };

export type PedidoPaymentRepository = {
  claim(input: ClaimInput): Promise<ClaimResult>;
  listPending(limit: number): Promise<PendingReceipt[]>;
};

// Los errores SQL no salen de aqui: solo un codigo corto.
export class PedidoPaymentRepositoryError extends Error {
  constructor(operation: string, readonly code: string) {
    super(`Pedido payment ${operation} failed: ${code}`);
    this.name = 'PedidoPaymentRepositoryError';
  }
}

export function createPedidoPaymentRepository(client: ServiceClient = createServiceRoleClient()): PedidoPaymentRepository {
  return {
    async claim(input) {
      const { data, error } = await client.rpc('reclamar_pago_yappy_para_pedido', {
        p_pedido_id: input.pedidoId, p_confirmation_code: input.code, p_idempotency_key: input.idempotencyKey,
        p_wa_id: input.waId, p_reintento: input.retry,
      });
      if (error) throw new PedidoPaymentRepositoryError('claim', error.code ?? 'unknown');
      const parsed = claimSchema.safeParse(data);
      if (!parsed.success) throw new PedidoPaymentRepositoryError('claim', 'invalid_response');
      const row = parsed.data;
      return {
        outcome: row.resultado, confirmed: row.confirmado, pedidoEstado: row.pedido_estado ?? null,
        total: row.total ?? 0, paid: row.pagado ?? 0, remaining: row.faltante ?? 0,
        deliveryPending: row.entrega_pendiente ?? false,
      };
    },
    async listPending(limit) {
      const { data, error } = await client.rpc('listar_comprobantes_pendientes', { p_limit: limit });
      if (error) throw new PedidoPaymentRepositoryError('listPending', error.code ?? 'unknown');
      const parsed = pendingSchema.safeParse(data);
      if (!parsed.success) throw new PedidoPaymentRepositoryError('listPending', 'invalid_response');
      return parsed.data.map((row) => ({ pedidoId: row.pedido_id, waId: row.wa_id, code: row.codigo }));
    },
  };
}
