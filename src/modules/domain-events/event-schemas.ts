import { z } from '@/platform/validation/zod';

// Payloads de eventos de dominio. Nunca incluyen contrasenas, codigos ni telefonos completos:
// solo ids, estados e importes. Deben coincidir con las llamadas a emit_domain_event en SQL.
const id = z.string().min(1).max(128);

export const DOMAIN_EVENT_SCHEMAS = {
  'venta.creada': z.object({
    venta_id: id, cliente_id: id.nullable(), servicio_id: id, categoria_id: id, estado: z.string().max(32),
  }),
  'venta.pago_registrado': z.object({
    venta_id: id, pago_id: id, periodo_id: id, numero_periodo: z.number().int(),
    total_usd: z.number(), moneda_original: z.string().max(8),
  }),
  'venta.reembolsada': z.object({
    venta_id: id, pago_id: id, periodo_id: id, monto_usd: z.number(),
    moneda_original: z.string().max(8), cortada: z.boolean(),
  }),
  'venta.transferida': z.object({ venta_id: id, from_servicio_id: id, to_servicio_id: id }),
  'servicio.credenciales_cambiadas': z.object({
    servicio_id: id, correo_cambiado: z.boolean(), contrasena_cambiada: z.boolean(),
  }),
  'yappy.pago_detectado': z.object({ payment_id: id, match_status: z.string().max(32), amount: z.number() }),
  'yappy.pago_resuelto': z.object({
    payment_id: id, venta_id: id, amount: z.number(), resolved_by: id.nullable(),
  }),
  // Sin telefonos ni codigos: solo ids, resultado e importes.
  'pedido.pago_reclamado': z.object({
    pedido_id: id, payment_id: id, resultado: z.string().max(32), monto: z.number(), faltante: z.number(),
    estado: z.string().max(32),
  }),
  'pedido.pago_en_revision': z.object({ pedido_id: id, motivo: z.string().max(32), faltante: z.number() }),
} as const;

export type DomainEventType = keyof typeof DOMAIN_EVENT_SCHEMAS;
type DomainEventPayloads = { [K in DomainEventType]: z.infer<(typeof DOMAIN_EVENT_SCHEMAS)[K]> };

export type DomainEvent = {
  [K in DomainEventType]: {
    id: string; type: K; aggregateType: string; aggregateId: string; payload: DomainEventPayloads[K];
    occurredAt: string; attempts: number;
  };
}[DomainEventType];

export type RawDomainEvent = {
  id: string; type: string; aggregateType: string; aggregateId: string; payload: unknown;
  occurredAt: string; attempts: number;
};

function isEventType(value: string): value is DomainEventType {
  return Object.hasOwn(DOMAIN_EVENT_SCHEMAS, value);
}

// null cuando el tipo es desconocido o el payload no cumple su esquema.
export function parseDomainEvent(raw: RawDomainEvent): DomainEvent | null {
  if (!isEventType(raw.type)) return null;
  const base = {
    id: raw.id, aggregateType: raw.aggregateType, aggregateId: raw.aggregateId,
    occurredAt: raw.occurredAt, attempts: raw.attempts,
  };
  switch (raw.type) {
    case 'venta.creada': {
      const p = DOMAIN_EVENT_SCHEMAS['venta.creada'].safeParse(raw.payload);
      return p.success ? { ...base, type: 'venta.creada', payload: p.data } : null;
    }
    case 'venta.pago_registrado': {
      const p = DOMAIN_EVENT_SCHEMAS['venta.pago_registrado'].safeParse(raw.payload);
      return p.success ? { ...base, type: 'venta.pago_registrado', payload: p.data } : null;
    }
    case 'venta.reembolsada': {
      const p = DOMAIN_EVENT_SCHEMAS['venta.reembolsada'].safeParse(raw.payload);
      return p.success ? { ...base, type: 'venta.reembolsada', payload: p.data } : null;
    }
    case 'venta.transferida': {
      const p = DOMAIN_EVENT_SCHEMAS['venta.transferida'].safeParse(raw.payload);
      return p.success ? { ...base, type: 'venta.transferida', payload: p.data } : null;
    }
    case 'servicio.credenciales_cambiadas': {
      const p = DOMAIN_EVENT_SCHEMAS['servicio.credenciales_cambiadas'].safeParse(raw.payload);
      return p.success ? { ...base, type: 'servicio.credenciales_cambiadas', payload: p.data } : null;
    }
    case 'yappy.pago_detectado': {
      const p = DOMAIN_EVENT_SCHEMAS['yappy.pago_detectado'].safeParse(raw.payload);
      return p.success ? { ...base, type: 'yappy.pago_detectado', payload: p.data } : null;
    }
    case 'yappy.pago_resuelto': {
      const p = DOMAIN_EVENT_SCHEMAS['yappy.pago_resuelto'].safeParse(raw.payload);
      return p.success ? { ...base, type: 'yappy.pago_resuelto', payload: p.data } : null;
    }
    case 'pedido.pago_reclamado': {
      const p = DOMAIN_EVENT_SCHEMAS['pedido.pago_reclamado'].safeParse(raw.payload);
      return p.success ? { ...base, type: 'pedido.pago_reclamado', payload: p.data } : null;
    }
    case 'pedido.pago_en_revision': {
      const p = DOMAIN_EVENT_SCHEMAS['pedido.pago_en_revision'].safeParse(raw.payload);
      return p.success ? { ...base, type: 'pedido.pago_en_revision', payload: p.data } : null;
    }
  }
}
