import { z } from '@/platform/validation/zod';

const uuid = z.string().uuid();
const ciclo = z.enum(['mensual', 'trimestral', 'semestral', 'anual']);
const itemBase = {
  ciclo_pago: ciclo,
  descuento: z.number().finite().min(0).max(100).multipleOf(0.01).default(0),
};
const item = z.discriminatedUnion('tipo', [
  z.object({ ...itemBase, tipo: z.literal('nueva'), plan_id: uuid, servicio_id: uuid,
    categoria_id: uuid.optional(), perfil_numero: z.number().int().positive().optional() }).strict(),
  z.object({ ...itemBase, tipo: z.literal('renovacion'), venta_id: uuid }).strict(),
]);
export const crearPedidoSchema = z.object({
  p_tercero_id: uuid.nullable(),
  p_contact_id: z.string().trim().min(1).max(100).nullable(),
  p_canal: z.enum(['panel', 'whatsapp']),
  p_moneda: z.string().regex(/^[A-Z]{3}$/),
  p_items: z.array(item).min(1).max(100),
  p_expira_at: z.iso.datetime({ offset: true }),
  // Units of original currency per USD, frozen with the order.
  p_exchange_rate: z.number().finite().positive(),
  p_idempotency_key: uuid,
}).strict().refine(p => p.p_tercero_id !== null || p.p_contact_id !== null,
  'El pedido requiere un cliente o contacto.').refine(p => p.p_moneda !== 'USD' || p.p_exchange_rate === 1,
  'USD requiere tasa 1.');
export const cancelarPedidoSchema = z.object({ p_pedido_id: uuid, p_idempotency_key: uuid }).strict();
export const confirmarPedidoSchema = cancelarPedidoSchema.extend({
  p_source: z.enum(['manual', 'yappy']),
  p_monto: z.number().finite().positive().max(9999999999.99).multipleOf(0.01),
  p_yappy_payment_id: uuid.nullable().default(null),
}).refine(p => (p.p_source === 'yappy') === (p.p_yappy_payment_id !== null),
  'Yappy requiere un pago identificado; manual no admite un pago Yappy.');

export type CrearPedidoInput = z.input<typeof crearPedidoSchema>;
export type ConfirmarPedidoInput = z.input<typeof confirmarPedidoSchema>;
export type CancelarPedidoInput = z.input<typeof cancelarPedidoSchema>;
