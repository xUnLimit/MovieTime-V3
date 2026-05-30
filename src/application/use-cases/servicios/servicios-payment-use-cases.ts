import { toDateOnly } from '@/platform/supabase/dates';
import {
  getPagoServicioById,
  getServicioById,
  queryPagosServicio,
  removePagoServicio,
  updateServicio,
  updateServicioPaymentAndPeriod,
} from '@/platform/supabase/servicios-repository';
import { sincronizarUnServicio } from '@/modules/notifications';
import { financialPayments } from '@/modules/payments';
import { getCurrencySymbol } from '@/platform/constants';
import type { MetodoPago, PagoServicio, Servicio } from '@/types';
import {
  getServicioTableUpdates,
  getUsdValues,
  normalizeServicioPagoInput,
  type LogContext,
  type RecordActivityLog,
  type ServicioPagoInput,
} from '@/application/use-cases/servicios/servicios-shared';

export async function renewServicioUseCase(
  servicio: Servicio,
  input: ServicioPagoInput,
  options: {
    numeroRenovacion?: number;
    metodoPago?: MetodoPago | null;
    logContext?: LogContext;
    recordActivityLog?: RecordActivityLog;
    logPrefix?: string;
  }
) {
  const { notaPrincipal, metodoPagoNombre, moneda, cicloPago } = normalizeServicioPagoInput(
    input,
    options.metodoPago,
    servicio.moneda
  );
  const renovacionAutomatica = input.renovacionAutomatica ?? servicio.renovacionAutomatica ?? false;

  const numeroRenovacion = options.numeroRenovacion ?? (
    await queryPagosServicio<PagoServicio>([{ field: 'servicioId', operator: '==', value: servicio.id }])
  ).filter((pago) => !pago.isPagoInicial && pago.descripcion !== 'Pago inicial').length + 1;

  await financialPayments.registerRenewalServicioPayment({
    servicioId: servicio.id,
    categoriaId: servicio.categoriaId || '',
    monto: input.costo,
    metodoPagoId: input.metodoPagoId,
    metodoPagoNombre,
    moneda,
    cicloPago,
    fechaInicio: input.fechaInicio,
    fechaVencimiento: input.fechaVencimiento,
    numeroRenovacion,
    notas: notaPrincipal,
    renovacionAutomatica,
  });

  const pronostico = {
    id: servicio.id,
    fechaVencimiento: input.fechaVencimiento.toISOString(),
    cicloPago: input.periodoRenovacion,
    costoServicio: input.costo,
    moneda,
  };
  await updateServicio(servicio.id, getServicioTableUpdates({ notas: notaPrincipal }));

  await options.recordActivityLog?.({
    ...(options.logContext ?? { usuarioId: 'sistema', usuarioEmail: 'sistema' }),
    accion: 'renovacion',
    entidad: 'servicio',
    entidadId: servicio.id,
    entidadNombre: `${servicio.nombre} [${servicio.correo}]`,
    detalles: `${options.logPrefix ?? 'Servicio renovado'}: "${servicio.nombre}" [${servicio.correo}] - ${getCurrencySymbol(moneda)}${input.costo} - hasta ${input.fechaVencimiento.toLocaleDateString('es-PA')} (${input.periodoRenovacion})`,
    metadata: {
      costoServicio: input.costo,
      moneda,
      cicloPago: input.periodoRenovacion,
      fechaInicio: toDateOnly(input.fechaInicio),
      fechaVencimiento: toDateOnly(input.fechaVencimiento),
      numeroRenovacion,
      origen: 'renewServicioUseCase',
    },
  });

  return {
    servicioActualizado: {
      ...servicio,
      fechaInicio: input.fechaInicio,
      fechaVencimiento: input.fechaVencimiento,
      costoServicio: input.costo,
      metodoPagoId: input.metodoPagoId || undefined,
      metodoPagoNombre,
      moneda,
      cicloPago,
      renovacionAutomatica,
      notas: notaPrincipal,
      updatedAt: new Date(),
    } as Servicio,
    pronostico,
  };
}

export async function updateServicioPagoUseCase(
  servicio: Servicio,
  pago: PagoServicio,
  input: ServicioPagoInput,
  options: {
    metodoPago?: MetodoPago | null;
    isLatestPayment: boolean;
  }
) {
  const { notaPrincipal, metodoPagoNombre, moneda, cicloPago } = normalizeServicioPagoInput(
    input,
    options.metodoPago,
    pago.moneda || servicio.moneda
  );
  const { usd, rate } = await getUsdValues(input.costo, moneda);
  const pagoActual = await getPagoServicioById<PagoServicio & { servicioPeriodoId?: string }>(pago.id);

  if (pagoActual?.servicioPeriodoId) {
    await updateServicioPaymentAndPeriod(pago.id, {
      fechaInicio: input.fechaInicio,
      fechaVencimiento: input.fechaVencimiento,
      cicloPago,
      costo: input.costo,
      moneda,
      costoUsd: usd,
      exchangeRate: rate,
      renovacionAutomatica: servicio.renovacionAutomatica,
      metodoPagoId: input.metodoPagoId,
      metodoPagoNombre,
      notas: notaPrincipal,
    });
  }

  let servicioActualizado: Servicio | null = null;
  if (options.isLatestPayment) {
    servicioActualizado = await getServicioById<Servicio>(servicio.id);
  }

  return { servicioActualizado };
}

export async function deleteServicioPagoUseCase(
  servicio: Servicio,
  pago: PagoServicio,
  _remainingPayments: PagoServicio[],
  options: {
    isLatestPayment: boolean;
    fallbackMoneda?: string;
  }
) {
  void _remainingPayments;
  await removePagoServicio(pago.id);

  let servicioActualizado: Servicio | null = null;
  if (options.isLatestPayment) {
    servicioActualizado = await getServicioById<Servicio>(servicio.id);
    await sincronizarUnServicio(servicio.id);
  }

  return { servicioActualizado };
}
