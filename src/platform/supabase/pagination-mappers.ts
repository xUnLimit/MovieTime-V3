import { ENTITIES } from './entities';

export function mapPaginatedRow(collectionName: string, row: unknown): unknown {
  const record = row as Record<string, unknown>;

  if (collectionName === ENTITIES.SERVICIOS) {
    return {
      ...record,
      tipo: record.tipo ?? record.planTipoId ?? '',
      tipoNombre: record.tipoNombre ?? record.planTipoNombre,
      costoServicio: Number(record.costoServicio ?? record.ultimoCostoOriginal ?? 0),
      moneda: record.moneda ?? record.ultimaMoneda ?? 'USD',
      cicloPago: record.cicloPago ?? record.ultimoCicloPago,
      fechaInicio: record.fechaInicio ?? record.ultimaFechaInicio,
      fechaVencimiento: record.fechaVencimiento ?? record.ultimaFechaVencimiento,
      renovacionAutomatica: Boolean(record.renovacionAutomatica ?? record.ultimaRenovacionAutomatica ?? false),
    };
  }

  if (collectionName === ENTITIES.VENTAS) {
    return {
      ...record,
      fechaInicio: record.fechaInicio ?? record.ultimaFechaInicio,
      fechaFin: record.fechaFin ?? record.ultimaFechaFin,
      cicloPago: record.cicloPago ?? record.ultimoCicloPago,
      precio: Number(record.precio ?? record.ultimoPrecioOriginal ?? record.ultimoTotalOriginal ?? 0),
      precioFinal: Number(record.precioFinal ?? record.ultimoTotalOriginal ?? 0),
      descuento: Number(record.descuento ?? record.ultimoDescuento ?? 0),
      metodoPagoId: record.metodoPagoId ?? record.ultimoMetodoPagoId,
      metodoPagoNombre: record.metodoPagoNombre ?? record.ultimoMetodoPagoNombre,
      moneda: record.moneda ?? record.ultimaMoneda ?? 'USD',
      planId: record.planId ?? record.ultimoPlanId,
      planNombre: record.planNombre ?? record.ultimoPlanNombre,
      planTipoNombre: record.planTipoNombre ?? record.ultimoPlanTipoNombre,
      renovaciones: Number(record.renovaciones ?? Math.max(Number(record.ultimoNumeroPeriodo ?? 1) - 1, 0)),
    };
  }

  return record;
}

export function toCamelCaseObject(row: unknown): unknown {
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map(toCamelCaseObject);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())] =
      toCamelCaseObject(value);
  }
  return result;
}

export function reviveDates<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(reviveDates) as T;

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (typeof nested === 'string' && /^\d{4}-\d{2}-\d{2}/.test(nested)) {
      result[key] = /^\d{4}-\d{2}-\d{2}$/.test(nested)
        ? dateOnlyToLocalDate(nested)
        : new Date(nested);
    } else {
      result[key] = reviveDates(nested);
    }
  }
  return result as T;
}

function dateOnlyToLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
