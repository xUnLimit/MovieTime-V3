import { z } from '@/platform/validation/zod';

const template = (variables: readonly string[], max = 1024) => z.string().trim().min(1).max(max)
  .refine(value => [...value.matchAll(/\{\{([^{}]+)\}\}/g)].every(match => variables.includes(match[1])));
const label = z.string().trim().min(1).max(24);

/** Editable renewal texts. The composition root loads them from settings/definition; nothing is fixed in the handler. */
export const renewMessagesSchema = z.object({
  compact: template(['seleccionados', 'total']),
  listButton: label, selectAll: label, clear: label, decline: label, confirm: label, more: label,
  emptySelection: template([]), unavailable: template([]), none: template([]),
  ordered: template(['pedidos', 'total']), declined: template([]), partialOff: template([]),
}).strict();
export type RenewMessages = z.infer<typeof renewMessagesSchema>;

export function defaultRenewMessages(): RenewMessages {
  return {
    compact: '{{seleccionados}} servicio(s) seleccionado(s). Total: {{total}}',
    listButton: 'Ver servicios', selectAll: 'Renovar todo', clear: 'Limpiar selección',
    decline: 'No continuar', confirm: 'Confirmar', more: 'Ver más',
    emptySelection: 'Elige al menos un servicio para continuar.',
    unavailable: 'Esta selección ya no está disponible. Pide un aviso nuevo o habla con un asesor.',
    none: 'No tienes servicios por renovar en este momento.',
    ordered: 'Preparamos {{pedidos}} pedido(s) de renovación. Total: {{total}}',
    declined: 'Listo, registramos que no deseas continuar con esos servicios.',
    partialOff: 'Renovaremos todos los servicios de tu aviso.',
  };
}
