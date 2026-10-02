import { z } from '@/platform/validation/zod';

export const servicioSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  categoriaId: z.string().min(1, 'Debe seleccionar una categoría'),
  tipoPlan: z.string().min(1, 'Debe seleccionar un tipo de plan'),
  correo: z.string().email('Por favor ingrese un correo electrónico válido'),
  contrasena: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
  metodoPagoId: z.string().min(1, 'Debe seleccionar un método de pago'),
  costoServicio: z
    .string()
    .refine((val) => val !== '', 'Por favor ingrese el costo del servicio')
    .refine((val) => !isNaN(Number(val)), 'El costo debe ser un valor numérico')
    .refine((val) => Number(val) > 0, 'El costo debe ser mayor a 0'),
  perfilesDisponibles: z
    .string()
    .refine((val) => val !== '', 'Por favor ingrese el número de perfiles')
    .refine((val) => !isNaN(Number(val)), 'Debe ingresar un valor numérico')
    .refine(
      (val) => Number(val) >= 1,
      'Debe tener al menos 1 perfil disponible',
    )
    .refine(
      (val) => Number.isInteger(Number(val)),
      'El número de perfiles debe ser un valor entero',
    ),
  cicloPago: z.enum(['mensual', 'trimestral', 'semestral', 'anual']),
  fechaInicio: z.date(),
  fechaVencimiento: z.date(),
  estado: z.enum(['activo', 'inactivo', 'reposo']),
  renovacionAutomatica: z.boolean(),
  accesoPorCodigo: z.boolean().optional(),
  diasReposo: z.string().optional(),
  notas: z.string().optional(),
});

export type ServicioFormData = z.infer<typeof servicioSchema>;
