import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { assertUuid } from '@/platform/utils/safety';
import { z } from '@/platform/validation/zod';
import { mergePurchaseMessages, type PurchaseMessages } from '@/modules/bot-config';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;
type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };
type PurchaseRpc = (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;

type PurchaseHold = { id: string; servicio: string; perfil: number; vence: string };
export type SaleCredentials = {
  ventaId: string; servicioId: string; servicio: string; categoria: string; correo: string;
  perfil: string | null; pin: string | null; codeAccess: boolean; provider: string | null;
  /** Always null when the account is code-access: SQL withholds it at the source. */
  password: string | null;
};
export type PurchaseRejectionReason = 'unsupported_number' | 'currency_mismatch' | 'hold_missing' | 'contact_invalid' | 'other';
export class PurchaseRejection extends Error {
  constructor(readonly reason: PurchaseRejectionReason) {
    super(`Bot purchase rejected: ${reason}`);
    this.name = 'PurchaseRejection';
  }
}
export type PurchaseStore = {
  settings(): Promise<{ maxItems: number; messages: PurchaseMessages }>;
  /** null means the plan has no free profile right now. */
  reserve(waId: string, planId: string): Promise<PurchaseHold | null>;
  createOrder(waId: string, planIds: string[], idempotencyKey: string): Promise<string>;
  /** Cancels an unpaid order and frees holds no live order needs. Safe to repeat. */
  release(waId: string, pedidoId?: string | null): Promise<number>;
  credentials(waId: string, ventaId: string): Promise<SaleCredentials | null>;
  /** Sales created by a paid order of this contact. */
  orderSales(waId: string, pedidoId: string): Promise<string[]>;
};

const waIdSchema = z.string().regex(/^[0-9]{7,15}$/);
const settingsSchema = z.object({ max_servicios: z.number().int().min(1).max(10), mensajes: z.unknown() });
const holdSchema = z.array(z.object({
  id: z.string().uuid(), servicio: z.string().min(1), perfil: z.number().int().positive(), vence: z.string().min(1),
})).max(1);
const credentialsSchema = z.object({
  venta_id: z.string().min(1), servicio_id: z.string().min(1), servicio: z.string(), categoria: z.string(),
  correo: z.string().min(1), perfil: z.string().nullable(), pin: z.string().nullable(),
  acceso_por_codigo: z.boolean(), proveedor_codigo: z.string().nullable(), contrasena: z.string().nullable(),
}).nullable();

function reasonOf(message: string | undefined): PurchaseRejectionReason {
  if (!message) return 'other';
  if (message.includes('purchase_unsupported_number')) return 'unsupported_number';
  if (message.includes('purchase_currency_mismatch')) return 'currency_mismatch';
  if (message.includes('purchase_hold_missing')) return 'hold_missing';
  if (message.includes('purchase_contact_invalid')) return 'contact_invalid';
  return 'other';
}

/** Service-role composition for the purchase flow. Responses never reach logs; errors carry only a reason. */
export function createBotPurchaseStore(client: Pick<ServiceClient, 'rpc'> = createServiceRoleClient()): PurchaseStore {
  const rpc: PurchaseRpc = (name, args) => {
    switch (name) {
      case 'obtener_ajustes_compra_bot': return client.rpc('obtener_ajustes_compra_bot', {});
      case 'reservar_perfil_para_plan': return client.rpc('reservar_perfil_para_plan', {
        p_wa_id: String(args.p_wa_id), p_plan_id: String(args.p_plan_id) });
      case 'crear_pedido_compra_bot': return client.rpc('crear_pedido_compra_bot', {
        p_wa_id: String(args.p_wa_id), p_plan_ids: z.array(z.string()).parse(args.p_plan_ids),
        p_idempotency_key: String(args.p_idempotency_key) });
      case 'liberar_compra_bot': return client.rpc('liberar_compra_bot', {
        p_wa_id: String(args.p_wa_id), p_pedido_id: typeof args.p_pedido_id === 'string' ? args.p_pedido_id : null });
      case 'credenciales_venta_bot': return client.rpc('credenciales_venta_bot', {
        p_wa_id: String(args.p_wa_id), p_venta_id: String(args.p_venta_id) });
      case 'ventas_pedido_bot': return client.rpc('ventas_pedido_bot', {
        p_wa_id: String(args.p_wa_id), p_pedido_id: String(args.p_pedido_id) });
      default: throw new Error('Purchase operation unavailable to the bot');
    }
  };
  async function call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await rpc(name, args);
    if (error) throw new PurchaseRejection(reasonOf(error.message));
    return data;
  }
  return {
    async settings() {
      const parsed = settingsSchema.parse(await call('obtener_ajustes_compra_bot', {}));
      return { maxItems: parsed.max_servicios, messages: mergePurchaseMessages(parsed.mensajes) };
    },
    async reserve(waId, planId) {
      const rows = holdSchema.parse(await call('reservar_perfil_para_plan', {
        p_wa_id: waIdSchema.parse(waId), p_plan_id: assertUuid(planId, 'Plan') }));
      return rows[0] ?? null;
    },
    async createOrder(waId, planIds, idempotencyKey) {
      return z.string().uuid().parse(await call('crear_pedido_compra_bot', {
        p_wa_id: waIdSchema.parse(waId), p_plan_ids: planIds.map(id => assertUuid(id, 'Plan')),
        p_idempotency_key: assertUuid(idempotencyKey, 'Clave') }));
    },
    async release(waId, pedidoId = null) {
      return z.number().int().nonnegative().parse(await call('liberar_compra_bot', {
        p_wa_id: waIdSchema.parse(waId), p_pedido_id: pedidoId === null ? null : assertUuid(pedidoId, 'Pedido') }));
    },
    async orderSales(waId, pedidoId) {
      return z.array(z.string().uuid()).max(100).parse(await call('ventas_pedido_bot', {
        p_wa_id: waIdSchema.parse(waId), p_pedido_id: assertUuid(pedidoId, 'Pedido') }));
    },
    async credentials(waId, ventaId) {
      const row = credentialsSchema.parse(await call('credenciales_venta_bot', {
        p_wa_id: waIdSchema.parse(waId), p_venta_id: assertUuid(ventaId, 'Venta') }));
      return row === null ? null : {
        ventaId: row.venta_id, servicioId: row.servicio_id, servicio: row.servicio, categoria: row.categoria,
        correo: row.correo, perfil: row.perfil, pin: row.pin, codeAccess: row.acceso_por_codigo,
        provider: row.proveedor_codigo, password: row.acceso_por_codigo ? null : row.contrasena,
      };
    },
  };
}
