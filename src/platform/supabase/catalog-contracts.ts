import { z } from '@/platform/validation/zod';

export const catalogEstadoSchema = z.enum(['disponible', 'ultimos', 'agotado']);
export const catalogItemSchema = z.object({
  categoria_id: z.string().uuid(), categoria_nombre: z.string().min(1),
  plan_id: z.string().uuid(), plan_nombre: z.string().min(1), plan_tipo_id: z.string().uuid(),
  precio: z.number().finite().nonnegative(), moneda: z.string().regex(/^[A-Z]{3}$/),
  ciclos: z.array(z.enum(['mensual', 'trimestral', 'semestral', 'anual'])).min(1),
  perfiles_libres: z.number().int().nonnegative(), estado: catalogEstadoSchema,
  orden: z.number().int(), alternativa_categoria_id: z.string().uuid().nullable(),
  alternativa_plan_id: z.string().uuid().nullable(),
}).superRefine((item, ctx) => {
  if ((item.perfiles_libres === 0) !== (item.estado === 'agotado')) {
    ctx.addIssue({ code: 'custom', path: ['estado'], message: 'Estado incompatible con stock' });
  }
});
export const catalogHoldSchema = z.object({
  id: z.string().uuid(), servicio_id: z.string().uuid(), perfil_numero: z.number().int().positive(),
  owner_ref: z.string().trim().min(1).max(200), expira_at: z.string().datetime({ offset: true }),
  created_at: z.string().datetime({ offset: true }), cerrada_at: z.string().datetime({ offset: true }).nullable(),
});
export const catalogInterestSchema = z.object({
  id: z.string().uuid(), contact_id: z.string().regex(/^[0-9]{1,32}$/), categoria_id: z.string().uuid(),
  plan_id: z.string().uuid().nullable(), origen: z.enum(['catalogo_agotado', 'manual']),
  estado: z.enum(['esperando', 'avisado', 'convertido', 'descartado']),
  created_at: z.string().datetime({ offset: true }), avisado_at: z.string().datetime({ offset: true }).nullable(),
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;
