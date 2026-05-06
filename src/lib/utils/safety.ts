type AsyncSideEffectContext = {
  operation: string;
  entity?: string;
  entityId?: string | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function assertUuid(value: unknown, label: string): string {
  if (!isUuid(value)) {
    throw new Error(`${label} debe ser un UUID valido`);
  }
  return value;
}

export function assertRpcStringId(data: unknown, operation: string): string {
  if (typeof data !== 'string' || data.trim() === '') {
    throw new Error(`${operation} no retorno un id valido`);
  }
  return data;
}

export function assertRecordId(data: unknown, operation: string): string {
  if (!data || typeof data !== 'object' || !('id' in data)) {
    throw new Error(`${operation} no retorno un registro con id`);
  }

  const id = (data as { id?: unknown }).id;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error(`${operation} retorno un id invalido`);
  }

  return id;
}

export function toMoneyNumber(value: unknown, label = 'monto'): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error(`${label} debe ser un numero valido`);
  }
  return amount;
}

export function safeAsyncSideEffect(
  promise: Promise<unknown>,
  context: AsyncSideEffectContext
): void {
  promise.catch((error) => {
    const scope = [
      context.operation,
      context.entity ? `entity=${context.entity}` : null,
      context.entityId ? `id=${context.entityId}` : null,
    ].filter(Boolean).join(' ');

    console.error(`[SideEffect] ${scope}`, error);
  });
}
