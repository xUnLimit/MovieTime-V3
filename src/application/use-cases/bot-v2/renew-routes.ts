import { z } from '@/platform/validation/zod';

const zero = z.literal('0');
const routeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('toggle'), value: z.string().uuid() }),
  z.object({ kind: z.literal('page'), value: z.coerce.number().int().min(0).max(1000) }),
  z.object({ kind: z.enum(['all', 'clear', 'decline', 'confirm']), value: zero }),
]);
export type RenewRoute = z.infer<typeof routeSchema>;

/** Strict codec for `BOT:REN:<kind>:<value>`; anything else is not ours. IDs never carry the notice or customer. */
export function renewRoute(id: string): RenewRoute | null {
  if (typeof id !== 'string' || id.length > 128) return null;
  const parts = id.split(':');
  if (parts.length !== 4 || parts[0] !== 'BOT' || parts[1] !== 'REN') return null;
  const result = routeSchema.safeParse({ kind: parts[2], value: parts[3] });
  return result.success ? result.data : null;
}
export const renewId = (kind: RenewRoute['kind'], value: string | number = '0') => `BOT:REN:${kind}:${value}`;
