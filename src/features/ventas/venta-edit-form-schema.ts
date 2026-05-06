import { z } from 'zod';

export const ventaEditSchema = z.object({
  clienteId: z.string().min(1, 'Seleccione un cliente'),
  metodoPagoId: z.string().min(1, 'Seleccione un método de pago'),
  categoriaId: z.string().min(1, 'Seleccione una categoría'),
  servicioId: z.string().min(1, 'Seleccione un servicio'),
  planId: z.string().min(1, 'Seleccione un plan'),
  perfilNumero: z.string().optional(),
  perfilNombre: z.string().optional(),
  precio: z.string().min(1, 'Ingrese un precio válido'),
  descuento: z.string().optional(),
  fechaInicio: z.date(),
  fechaFin: z.date(),
  codigo: z.string().optional(),
  estado: z.enum(['activo', 'inactivo']),
  notas: z.string().optional(),
});

export type VentaEditFormData = z.infer<typeof ventaEditSchema>;
