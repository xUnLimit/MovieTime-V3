import { convertToUSD } from '@/modules/payments';
import { toMoneyNumber } from '@/platform/utils/safety';
import type { ActivityLog, MetodoPago, Servicio } from '@/types';
import type { ServicioPronostico } from '@/types/dashboard';

export type RecordActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
export type LogContext = Pick<ActivityLog, 'usuarioId' | 'usuarioEmail'>;

export type ServicioPagoInput = {
  idempotencyKey?: string;
  periodoRenovacion: string;
  metodoPagoId: string;
  costo: number;
  descuento?: number;
  fechaInicio: Date;
  fechaVencimiento: Date;
  notas?: string;
  metodoPagoNombre?: string;
  moneda?: string;
  renovacionAutomatica?: boolean;
};

export function normalizeServicioPagoInput(
  input: ServicioPagoInput,
  metodoPago?: MetodoPago | null,
  fallbackMoneda = 'USD'
) {
  return {
    notaPrincipal: input.notas?.trim() ?? '',
    metodoPagoNombre: input.metodoPagoNombre || metodoPago?.nombre || '',
    moneda: input.moneda || metodoPago?.moneda || fallbackMoneda || 'USD',
    cicloPago: input.periodoRenovacion as 'mensual' | 'trimestral' | 'semestral' | 'anual',
  };
}

const SERVICIO_TABLE_UPDATE_KEYS = [
  'categoriaId',
  'tipo',
  'nombre',
  'correo',
  'contrasena',
  'perfilesDisponibles',
  'activo',
  'enReposo',
  'diasReposo',
  'fechaInicioReposo',
  'fechaFinReposo',
  'cortadoAt',
  'cortadoBy',
  'motivoCorte',
  'archivadoAt',
  'archivadoBy',
  'motivoArchivado',
  'notas',
  'createdBy',
] as const satisfies ReadonlyArray<keyof Servicio>;

export function getServicioTableUpdates(updates: Partial<Servicio>): Partial<Servicio> {
  const result: Partial<Servicio> = {};
  for (const key of SERVICIO_TABLE_UPDATE_KEYS) {
    assignDefined(result, updates, key);
  }
  return result;
}

function assignDefined<T extends object, K extends keyof T>(
  target: Partial<T>,
  source: Partial<T>,
  key: K,
) {
  const value = source[key];
  if (value !== undefined) target[key] = value;
}

const SERVICIO_PERIODO_UPDATE_KEYS = [
  'costoServicio',
  'moneda',
  'cicloPago',
  'fechaInicio',
  'fechaVencimiento',
  'renovacionAutomatica',
  'metodoPagoId',
] as const satisfies ReadonlyArray<keyof Servicio>;

export function hasServicioPeriodoUpdates(updates: Partial<Servicio>): boolean {
  return SERVICIO_PERIODO_UPDATE_KEYS.some((key) => updates[key] !== undefined);
}

export async function getUsdValues(amount: number, moneda: string) {
  const normalizedAmount = toMoneyNumber(amount);
  const usd = await convertToUSD(normalizedAmount, moneda);
  return {
    usd,
    rate: moneda === 'USD' || normalizedAmount === 0 || usd === 0 ? 1 : normalizedAmount / usd,
  };
}

export function toServicioPronostico(s: Servicio): ServicioPronostico | null {
  if (!s.activo || s.enReposo || !s.fechaVencimiento || !s.cicloPago || s.costoServicio <= 0) return null;
  return {
    id: s.id,
    fechaVencimiento: s.fechaVencimiento instanceof Date
      ? s.fechaVencimiento.toISOString()
      : String(s.fechaVencimiento),
    cicloPago: s.cicloPago,
    costoServicio: s.costoServicio,
    moneda: s.moneda || 'USD',
  };
}
