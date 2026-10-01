import { queryPagosServicio } from '@/platform/supabase/pagos-repository';
import { createPagoServicio, createPagoVenta } from '@/platform/supabase/payments-repository';
import { convertToUSD } from './currency-converter';
import type { PagoServicio } from '@/types';

type CicloPago = 'mensual' | 'trimestral' | 'semestral' | 'anual';

export async function createInitialVentaPayment(
  ventaId: string,
  clienteId: string,
  clienteNombre: string,
  categoriaId: string,
  monto: number,
  metodoPago: string,
  metodoPagoId?: string,
  moneda?: string,
  cicloPago?: CicloPago,
  notas?: string,
  fechaInicio?: Date,
  fechaVencimiento?: Date,
  idempotencyKey?: string
): Promise<string> {
  const conversion = await convertAmountToUSD(monto, moneda);
  return createPagoVenta({
    idempotencyKey,
    ventaId,
    clienteId,
    clienteNombre,
    categoriaId,
    fecha: new Date(),
    monto,
    montoUsd: conversion.usd,
    exchangeRate: conversion.rate,
    metodoPagoId,
    metodoPago,
    moneda,
    notas: notas ?? '',
    isPagoInicial: true,
    cicloPago,
    fechaInicio,
    fechaVencimiento,
  });
}

export async function createRenewalVentaPayment(
  ventaId: string,
  clienteId: string,
  clienteNombre: string,
  categoriaId: string,
  monto: number,
  metodoPago: string,
  metodoPagoId?: string,
  moneda?: string,
  cicloPago?: CicloPago,
  notas?: string,
  fechaInicio?: Date,
  fechaVencimiento?: Date,
  precio?: number,
  descuento?: number,
  planId?: string,
  planNombre?: string,
  planTipoNombre?: string,
  idempotencyKey?: string
): Promise<string> {
  const conversion = await convertAmountToUSD(monto, moneda);
  return createPagoVenta({
    ventaId,
    clienteId,
    clienteNombre,
    categoriaId,
    fecha: new Date(),
    monto,
    montoUsd: conversion.usd,
    exchangeRate: conversion.rate,
    precio,
    descuento,
    metodoPagoId,
    metodoPago,
    moneda,
    notas: notas ?? '',
    isPagoInicial: false,
    cicloPago,
    fechaInicio,
    fechaVencimiento,
    planId,
    planNombre,
    planTipoNombre,
    idempotencyKey,
  });
}

export async function createInitialServicioPayment(
  servicioId: string,
  categoriaId: string,
  monto: number,
  metodoPagoId: string,
  metodoPagoNombre: string,
  moneda: string,
  cicloPago: CicloPago,
  fechaInicio: Date,
  fechaVencimiento: Date,
  notas?: string,
  renovacionAutomatica?: boolean,
  idempotencyKey?: string
): Promise<void> {
  const conversion = await convertAmountToUSD(monto, moneda);
  await createPagoServicio({
    servicioId,
    categoriaId,
    fecha: new Date(),
    descripcion: 'Pago inicial',
    cicloPago,
    fechaInicio,
    fechaVencimiento,
    monto,
    montoUsd: conversion.usd,
    exchangeRate: conversion.rate,
    metodoPagoId,
    metodoPagoNombre,
    moneda,
    renovacionAutomatica,
    isPagoInicial: true,
    notas: notas || '',
    idempotencyKey,
  });
}

export async function createRenewalServicioPayment(
  servicioId: string,
  categoriaId: string,
  monto: number,
  metodoPagoId: string,
  metodoPagoNombre: string,
  moneda: string,
  cicloPago: CicloPago,
  fechaInicio: Date,
  fechaVencimiento: Date,
  numeroRenovacion: number,
  notas?: string,
  renovacionAutomatica?: boolean,
  idempotencyKey?: string
): Promise<void> {
  const conversion = await convertAmountToUSD(monto, moneda);
  await createPagoServicio({
    servicioId,
    categoriaId,
    fecha: new Date(),
    descripcion: `Renovación #${numeroRenovacion}`,
    cicloPago,
    fechaInicio,
    fechaVencimiento,
    monto,
    montoUsd: conversion.usd,
    exchangeRate: conversion.rate,
    metodoPagoId,
    metodoPagoNombre,
    moneda,
    renovacionAutomatica,
    isPagoInicial: false,
    notas: notas || '',
    idempotencyKey,
  });
}

export async function getServicioPayments(servicioId: string): Promise<PagoServicio[]> {
  const docs = await queryPagosServicio<PagoServicio>([
    { field: 'servicioId', operator: '==', value: servicioId },
  ]);

  return sortServicioPaymentsByNewest(docs);
}

function sortServicioPaymentsByNewest(payments: PagoServicio[]): PagoServicio[] {
  return [...payments].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}


// La conversion de moneda es una decision de negocio: el repositorio solo persiste valores ya convertidos.
async function convertAmountToUSD(amount: number, moneda?: string | null) {
  const currency = String(moneda ?? 'USD');
  const monto = Number(amount ?? 0);
  const usd = await convertToUSD(monto, currency);
  return {
    usd,
    rate: currency === 'USD' || monto === 0 || usd === 0 ? 1 : monto / usd,
  };
}
