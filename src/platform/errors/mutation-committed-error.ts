/** The financial transaction succeeded; only a subsequent action failed. */
export class MutationCommittedError extends Error {
  constructor(readonly operationId: string, cause: unknown) {
    super('La operacion se guardo, pero no se pudo completar la actualizacion de datos secundarios.', { cause });
    this.name = 'MutationCommittedError';
  }
}

export async function afterCommit<T>(operationId: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof MutationCommittedError) throw error;
    throw new MutationCommittedError(operationId, error);
  }
}
