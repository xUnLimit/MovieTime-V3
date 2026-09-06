import { toast } from 'sonner';
import { MutationCommittedError } from '@/platform/errors/mutation-committed-error';

/** Returns true when retrying the financial operation is unnecessary. */
export function notifyCommittedMutation(error: unknown): boolean {
  if (!(error instanceof MutationCommittedError)) return false;
  toast.warning('Operacion guardada con advertencia', {
    description: 'El registro ya se guardo. Actualiza la pagina para comprobar los datos; no repitas el pago. No se pudo completar una actualizacion secundaria.',
    duration: 10000,
  });
  return true;
}
