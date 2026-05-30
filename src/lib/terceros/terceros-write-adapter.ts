import {
  createTercero,
  removeTercero,
  updateTercero,
} from '@/platform/supabase/terceros-repository';
import { isPendingTerceroPaymentMethodId } from '@/platform/utils/terceroMetodoPago';
import type { Tercero } from '@/types';

export type CreateTerceroInput = Omit<Tercero, 'id' | 'createdAt' | 'updatedAt' | 'serviciosActivos'>;
export type UpdateTerceroInput = Omit<Partial<Tercero>, 'metodoPagoId'> & {
  metodoPagoId?: string | null;
};

type TerceroWritePayload = Omit<Partial<
  Pick<
    Tercero,
    | 'nombre'
    | 'apellido'
    | 'tipo'
    | 'telefono'
    | 'email'
    | 'metodoPagoId'
    | 'active'
    | 'notas'
    | 'createdBy'
  >
>, 'metodoPagoId'> & { metodoPagoId?: string | null };

const TERCERO_WRITE_KEYS = [
  'nombre',
  'apellido',
  'tipo',
  'telefono',
  'email',
  'metodoPagoId',
  'active',
  'notas',
  'createdBy',
] as const satisfies ReadonlyArray<keyof TerceroWritePayload>;

export function toTerceroWritePayload(input: UpdateTerceroInput): TerceroWritePayload {
  const payload: TerceroWritePayload = {};

  for (const field of TERCERO_WRITE_KEYS) {
    const value = input[field];
    if (value === undefined) continue;
    if (field === 'metodoPagoId') {
      payload.metodoPagoId = isPendingTerceroPaymentMethodId(value as string | null)
        ? null
        : input.metodoPagoId;
      continue;
    }
    if (field === 'active') {
      payload.active = input.active;
      continue;
    }
    if (field === 'tipo') payload.tipo = input.tipo;
    if (field === 'nombre') payload.nombre = input.nombre;
    if (field === 'apellido') payload.apellido = input.apellido;
    if (field === 'telefono') payload.telefono = input.telefono;
    if (field === 'email') payload.email = input.email;
    if (field === 'notas') payload.notas = input.notas;
    if (field === 'createdBy') payload.createdBy = input.createdBy;
  }

  return payload;
}

export async function createTerceroFromDomain(input: CreateTerceroInput): Promise<string> {
  return createTercero(toTerceroWritePayload({ ...input, active: true }));
}

export async function updateTerceroFromDomain(
  id: string,
  updates: UpdateTerceroInput,
): Promise<void> {
  await updateTercero(id, toTerceroWritePayload(updates));
}

export async function removeTerceroFromDomain(id: string): Promise<void> {
  await removeTercero(id);
}

export async function updateTerceroMetodoPago(
  id: string,
  metodoPagoId: string | null,
): Promise<void> {
  await updateTerceroFromDomain(id, { metodoPagoId });
}
