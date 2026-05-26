import {
  countMetodosPago,
  createMetodoPago,
  getMetodoPagoById,
  removeMetodoPago,
  updateMetodoPago,
} from '@/lib/supabase/catalogos-repository';
import type { MetodoPago } from '@/types';

export function getMetodoPagoUseCase(id: string) {
  return getMetodoPagoById<MetodoPago>(id);
}

export async function fetchMetodosPagoCountsUseCase() {
  await Promise.all([
    countMetodosPago([{ field: 'asociadoA', operator: 'in', value: ['tercero', 'servicio'] }]),
    countMetodosPago([{ field: 'asociadoA', operator: '==', value: 'tercero' }]),
    countMetodosPago([{ field: 'asociadoA', operator: '==', value: 'servicio' }]),
  ]);
}

export async function createMetodoPagoUseCase(
  metodoData: Omit<MetodoPago, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const id = await createMetodoPago(metodoData as Omit<MetodoPago, 'id'>);
  return {
    ...metodoData,
    id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function updateMetodoPagoUseCase(
  id: string,
  updates: Partial<MetodoPago>,
) {
  await updateMetodoPago(id, updates);
}

export async function deleteMetodoPagoUseCase(id: string) {
  await removeMetodoPago(id);
}
