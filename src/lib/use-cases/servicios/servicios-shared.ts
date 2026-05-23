import { convertToUSD } from '@/lib/payments';
import { toMoneyNumber } from '@/lib/utils/safety';
import type { ActivityLog, MetodoPago, Servicio } from '@/types';
import type { ServicioPronostico } from '@/types/dashboard';

export type RecordActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
export type LogContext = Pick<ActivityLog, 'usuarioId' | 'usuarioEmail'>;

export type ServicioPagoInput = {
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

const SERVICIO_TABLE_UPDATE_KEYS = new Set([
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
]);

export function getServicioTableUpdates(updates: Partial<Servicio>): Partial<Servicio> {
  const result: Partial<Servicio> = {};
  const source = updates as Record<string, unknown>;
  const target = result as Record<string, unknown>;
  for (const key of SERVICIO_TABLE_UPDATE_KEYS) {
    if (source[key] !== undefined) target[key] = source[key];
  }
  return result;
}

export function hasServicioPeriodoUpdates(updates: Partial<Servicio>): boolean {
  return [
    'costoServicio',
    'moneda',
    'cicloPago',
    'fechaInicio',
    'fechaVencimiento',
    'renovacionAutomatica',
    'metodoPagoId',
  ].some((key) => (updates as Record<string, unknown>)[key] !== undefined);
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
