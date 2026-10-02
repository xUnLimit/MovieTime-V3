import { ConflictError } from '@/platform/errors/domain-errors';

export function assertOnlineMutation(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ConflictError('Se requiere conexion para registrar el pedido.');
  }
}
