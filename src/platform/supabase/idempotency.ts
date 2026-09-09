export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function withIdempotencyKey<T extends object>(
  payload: T & { p_idempotency_key?: string | null }
): T & { p_idempotency_key: string } {
  return {
    ...payload,
    p_idempotency_key: payload.p_idempotency_key ?? createIdempotencyKey(),
  };
}
