import { z } from '@/platform/validation/zod';

const template = (variables: readonly string[]) => z.string().trim().min(1).max(1024)
  .refine(value => [...value.matchAll(/\{\{([^{}]+)\}\}/g)].every(match => variables.includes(match[1])));
export const catalogMessagesSchema = z.object({
  summary: template(['disponibles', 'agotados']),
  platforms: template([]), plans: template([]), empty: template([]),
  interest: template(['servicio']), registered: template(['servicio']),
}).strict();
export type CatalogMessages = z.infer<typeof catalogMessagesSchema>;
export function defaultCatalogMessages(): CatalogMessages {
  return {
    summary: '*Disponibles*\n{{disponibles}}\n\n*Agotados*\n{{agotados}}',
    platforms: 'Elige una plataforma.', plans: 'Elige un plan.', empty: 'No hay opciones en este momento.',
    interest: '{{servicio}} está agotado. ¿Qué prefieres?',
    registered: 'Te avisaremos cuando haya {{servicio}}.',
  };
}
