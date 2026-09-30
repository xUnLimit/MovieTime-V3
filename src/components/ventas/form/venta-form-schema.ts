import { z } from '@/platform/validation/zod';

export const ventaSchema = z.object({
  clienteId: z.string().min(1, 'Seleccione un cliente'),
  metodoPagoId: z.string().min(1, 'Seleccione un metodo de pago'),
  fechaInicio: z.date(),
  fechaFin: z.date(),
  codigo: z.string().optional(),
  estado: z.enum(['activo', 'inactivo']),
});

export type VentaFormData = z.infer<typeof ventaSchema>;
