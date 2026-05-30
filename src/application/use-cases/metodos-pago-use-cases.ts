import {
  createMetodoPago,
  getMetodosPago,
  getMetodoPagoById,
  removeMetodoPago,
  updateMetodoPago,
} from '@/platform/supabase/catalogos-repository';
import {
  getMetodoPagoRead,
  queryMetodosPagoServiciosRead,
  queryMetodosPagoTercerosRead,
} from '@/platform/supabase/domain-read-adapters';
import type { MetodoPago } from '@/types';

export function getMetodoPagoUseCase(id: string) {
  return getMetodoPagoById<MetodoPago>(id);
}

export function getMetodoPagoReadUseCase(id: string) {
  return getMetodoPagoRead(id);
}

export function fetchMetodosPagoUseCase() {
  return getMetodosPago<MetodoPago>();
}

export function queryMetodosPagoServiciosUseCase(options: { soloActivos?: boolean } = {}) {
  return queryMetodosPagoServiciosRead(options);
}

export function queryMetodosPagoTercerosUseCase(options: { soloActivos?: boolean } = {}) {
  return queryMetodosPagoTercerosRead(options);
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
