import { z } from '@/platform/validation/zod';

const money = z.number().finite().nonnegative();
const cycle = z.enum(['mensual', 'trimestral', 'semestral', 'anual']);

export const pedidoSchema = z.object({
  id: z.uuid(), terceroId: z.string().nullable(), contactId: z.string().nullable(),
  moneda: z.string(), total: money, estado: z.string(),
  paymentState: z.enum(['pendiente', 'parcial', 'cubierto', 'exceso', 'reembolsado', 'parcialmente_reembolsado']),
  deliveryState: z.enum(['pendiente', 'parcial', 'asignado', 'enviado']),
  receivedAmount: money, missingAmount: money, excessAmount: money,
  allocatedAmount: money.optional(), refundedAmount: money.optional(), unallocatedAmount: money.optional(),
  expiraAt: z.string(),
  items: z.array(z.object({
    id: z.uuid(), tipo: z.enum(['nueva', 'renovacion']), servicioId: z.string(),
    ventaId: z.string().nullable(), planNombre: z.string(), total: money,
    estado: z.string(), ventaIdResultante: z.string().nullable(),
  })),
});
export type Pedido = z.infer<typeof pedidoSchema>;

export const catalogoSchema = z.array(z.object({
  planId: z.string(), planNombre: z.string(), categoriaId: z.string(), categoriaNombre: z.string(),
  precio: money, moneda: z.string(), cicloPago: cycle, perfilesLibres: z.number().int().nonnegative(),
}));

export const panelCartSchema = z.array(z.object({
  clienteId: z.uuid(), moneda: z.string().min(3).max(3), exchangeRate: z.number().positive().finite(),
  items: z.array(z.object({
    planId: z.uuid(), servicioId: z.uuid(), perfilNumero: z.number().int().positive().nullable(),
    descuento: money.max(100), precio: money,
    cicloPago: cycle, fechaInicio: z.iso.date(), fechaFin: z.iso.date(),
    estado: z.enum(['activo', 'inactivo']), perfilNombre: z.string().max(200),
    codigo: z.string().max(200), notas: z.string().max(5000),
    metodoPagoId: z.uuid().nullable(), metodoPagoNombre: z.string().max(200),
  }).refine(item => item.fechaFin >= item.fechaInicio, 'El vencimiento debe ser posterior al inicio')).min(1).max(100),
})).min(1).max(10).refine(groups => new Set(groups.map(group => group.moneda)).size === groups.length,
  'Cada moneda debe tener un solo pedido').refine(groups => new Set(groups.map(group => group.clienteId)).size === 1,
  'El carrito debe pertenecer a un solo cliente');
export type PanelCart = z.infer<typeof panelCartSchema>;

export const serverCartSchema = z.object({
  waId: z.string().regex(/^507\d{8}$/), ids: z.array(z.uuid()).min(1).max(10), key: z.uuid(), expectedTotal: money,
});
export const receiptSchema = z.object({
  id: z.uuid(), code: z.string().trim().min(4).max(64).regex(/^[A-Za-z0-9-]+$/), key: z.uuid(),
});
