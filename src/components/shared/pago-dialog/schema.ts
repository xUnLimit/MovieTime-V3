import * as z from 'zod';

export const pagoDialogSchema = z.object({
  periodoRenovacion: z
    .string()
    .refine((v) => ['mensual', 'trimestral', 'semestral', 'anual'].includes(v), {
      message: 'Seleccione el ciclo de facturación',
    }),
  metodoPagoId: z.string().min(1, 'El método de pago es requerido'),
  costo: z.number().min(0, 'El costo debe ser mayor a 0'),
  descuento: z.number().min(0).max(100).optional(),
  fechaInicio: z.date(),
  fechaVencimiento: z.date(),
  notas: z.string().optional(),
  notificarWhatsApp: z.boolean().optional(),
  renovacionAutomatica: z.boolean().optional(),
});

export type PagoDialogFormData = z.infer<typeof pagoDialogSchema>;
