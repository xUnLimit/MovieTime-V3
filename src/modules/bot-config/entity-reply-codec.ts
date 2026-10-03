import { isUuid } from '@/platform/utils/safety';

// Add a capability here, never via JSON. Uppercase namespace cannot collide with option slugs.
export const ENTITY_REPLY_REGISTRY = {
  CODE: { validate: isUuid },
  ORDER: { validate: isUuid },
  SERVICE: { validate: isUuid },
} as const;
type EntityKind = keyof typeof ENTITY_REPLY_REGISTRY;
type EntityReply = { kind: EntityKind; entityId: string };
const bytes = (value: string) => new TextEncoder().encode(value).length;
function isKind(value: string): value is EntityKind { return Object.hasOwn(ENTITY_REPLY_REGISTRY, value); }
export function encodeEntityReplyId(reply: EntityReply): string {
  const id = `BOT:${reply.kind}:${reply.entityId}`;
  if (!isKind(reply.kind) || !ENTITY_REPLY_REGISTRY[reply.kind].validate(reply.entityId) || bytes(id) > 256) throw new Error('Invalid entity reply ID');
  return id;
}
export function decodeEntityReplyId(id: string): EntityReply | null {
  if (typeof id !== 'string' || bytes(id) > 256) return null;
  const parts = id.split(':');
  if (parts.length !== 3 || parts[0] !== 'BOT' || !isKind(parts[1])) return null;
  const kind = parts[1];
  return ENTITY_REPLY_REGISTRY[kind].validate(parts[2]) ? { kind, entityId: parts[2] } : null;
}
