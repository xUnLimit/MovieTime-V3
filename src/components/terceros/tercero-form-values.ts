import { z } from '@/platform/validation/zod';
import { isPendingTerceroPaymentMethodId, PENDING_TERCERO_PAYMENT_ID } from '@/platform/utils/terceroMetodoPago';
import type { Tercero } from '@/types';

export const usuarioSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  tipoTercero: z.enum(["cliente", "revendedor"], {
    message: "Debe seleccionar un tipo de tercero",
  }),
  telefono: z.string().min(8, "El telefono debe tener al menos 8 digitos"),
  metodoPagoId: z.string().min(1, "El metodo de pago es requerido"),
  notas: z.string().optional(),
});

export type TerceroFormData = z.infer<typeof usuarioSchema>;


export type TerceroValoresIniciales = { nombre?: string; apellido?: string; telefono?: string };

export function getTerceroFormValues(usuario: Tercero | null | undefined, tipoInicial: 'cliente' | 'revendedor', valoresIniciales?: TerceroValoresIniciales): TerceroFormData {
  return usuario ? {
    nombre: usuario.nombre || '', apellido: usuario.apellido || '', tipoTercero: usuario.tipo, telefono: usuario.telefono,
    metodoPagoId: isPendingTerceroPaymentMethodId(usuario.metodoPagoId) ? PENDING_TERCERO_PAYMENT_ID : usuario.metodoPagoId, notas: usuario.notas || '',
  } : {
    nombre: valoresIniciales?.nombre ?? '', apellido: valoresIniciales?.apellido ?? '', tipoTercero: tipoInicial, telefono: valoresIniciales?.telefono ?? '',
    metodoPagoId: PENDING_TERCERO_PAYMENT_ID, notas: '',
  };
}
