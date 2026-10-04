import { ValidationError } from '@/platform/errors/domain-errors';

export function assertOnlineMutation(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ValidationError('Conéctate a internet antes de registrar esta operación.');
  }
}
