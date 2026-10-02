import { calculateDiscountedAmount } from '@/platform/utils/calculations';
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

const panelSnapshot = z.object({
  item_id: z.string().min(1).max(100),
  precio: z.number().finite().nonnegative().multipleOf(0.01),
  total: z.number().finite().nonnegative().multipleOf(0.01),
  estado: z.enum(['activo', 'inactivo']),
  fecha_inicio: z.iso.date(), fecha_fin: z.iso.date(),
  perfil_nombre: z.string().max(200), codigo: z.string().max(200), notas: z.string().max(5000),
  metodo_pago_id: uuid.nullable(), metodo_pago_nombre: z.string().max(200),
}).strict().refine(p => p.fecha_fin >= p.fecha_inicio, 'Las fechas de la venta no son validas.');
const panelItem = z.object({
  ...itemBase, tipo: z.literal('nueva'), plan_id: uuid, servicio_id: uuid,
  categoria_id: uuid, perfil_numero: z.number().int().positive().optional(), panel: panelSnapshot,
}).strict().refine(i => calculateDiscountedAmount(i.panel.precio, i.descuento ?? 0) === i.panel.total, 'El total del item no coincide con su precio y descuento.');
export const confirmarPedidoPanelSchema = z.object({
  p_idempotency_key: uuid,
  p_panel_pedidos: z.array(z.object({
    cliente_id: uuid, moneda: z.string().regex(/^[A-Z]{3}$/),
    exchange_rate: z.number().finite().positive(), monto: z.number().finite().nonnegative().multipleOf(0.01),
    crear_key: uuid, confirmar_key: uuid, items: z.array(panelItem).min(1).max(100),
  }).strict().refine(g => g.moneda !== 'USD' || g.exchange_rate === 1, 'USD requiere tasa 1.')
    .refine(g => Math.round(g.items.reduce((sum, i) => sum + i.panel.total, 0) * 100) ===
      Math.round(g.monto * 100), 'El monto no coincide con el carrito.')).min(1).max(100),
}).strict().refine(p => p.p_panel_pedidos.reduce((sum, g) => sum + g.items.length, 0) <= 100,
  'El carrito admite hasta 100 items.')
  .refine(p => new Set(p.p_panel_pedidos.map(g => g.moneda)).size === p.p_panel_pedidos.length,
    'Cada moneda requiere un solo pedido.')
  .refine(p => new Set(p.p_panel_pedidos.map(g => g.cliente_id)).size === 1, 'El carrito requiere un solo cliente.');
export type ConfirmarPedidoPanelInput = z.input<typeof confirmarPedidoPanelSchema>;
