import { toSnakeCase } from './mappers';
import { toDateOnly } from './dates';
import type { CollectionName } from './entities';

export function snakeField(field: string) {
  if (field === '__name__') return 'id';
  return Object.keys(toSnakeCase<Record<string, unknown>>({ [field]: true }))[0];
}

export function readField(collectionName: CollectionName, field: string) {
  if (field === '__name__') return 'id';

  const viewFieldMap: Partial<Record<CollectionName, Record<string, string>>> = {
    ventas: {
      fechaInicio: 'ultima_fecha_inicio',
      fechaFin: 'ultima_fecha_fin',
      cicloPago: 'ultimo_ciclo_pago',
      precio: 'ultimo_total_original',
      precioFinal: 'ultimo_total_original',
      moneda: 'ultima_moneda',
    },
    servicios: {
      tipo: 'plan_tipo_id',
      tipoNombre: 'plan_tipo_nombre',
      fechaInicio: 'ultima_fecha_inicio',
      fechaVencimiento: 'ultima_fecha_vencimiento',
      cicloPago: 'ultimo_ciclo_pago',
      costoServicio: 'ultimo_costo_original',
      moneda: 'ultima_moneda',
      renovacionAutomatica: 'ultima_renovacion_automatica',
    },
    pagosVenta: {
      fecha: 'fecha_pago',
      monto: 'monto_original',
      moneda: 'moneda_original',
      metodoPago: 'metodo_pago_nombre_snapshot',
      fechaInicio: 'periodo_inicio',
      fechaVencimiento: 'periodo_fin',
    },
    pagosServicio: {
      fecha: 'fecha_pago',
      monto: 'monto_original',
      moneda: 'moneda_original',
      metodoPagoNombre: 'metodo_pago_nombre_snapshot',
      fechaInicio: 'periodo_inicio',
      fechaVencimiento: 'periodo_vencimiento',
    },
    gastos: {
      monto: 'monto_original',
      moneda: 'moneda_original',
    },
  };

  return viewFieldMap[collectionName]?.[field] ?? snakeField(field);
}

export function normalizeFilterValue(field: string, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFilterValue(field, item));
  }

  if (value instanceof Date) {
    return isDateOnlyField(field) ? toDateOnly(value) : value.toISOString();
  }

  return value;
}

function isDateOnlyField(field: string) {
  return (
    field.includes('fecha_') ||
    field.startsWith('ultima_fecha_') ||
    field.startsWith('periodo_') ||
    field.endsWith('_snapshot') ||
    field === 'scheduled_for'
  );
}
