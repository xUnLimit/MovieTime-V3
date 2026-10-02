import { expect, it } from 'vitest';
import { decodeEntityReplyId, encodeEntityReplyId, ENTITY_REPLY_REGISTRY } from './entity-reply-codec';
import { parseOptionReplyId } from './payload';
const uuid = '51111111-1111-4111-8111-111111111111';
it.each(['CODE', 'ORDER', 'SERVICE'] as const)('round trips registered %s entity and isolates option IDs', kind => {
  expect(Object.hasOwn(ENTITY_REPLY_REGISTRY, kind)).toBe(true);
  const id = encodeEntityReplyId({ kind, entityId: uuid });
  expect(id).toBe(`BOT:${kind}:${uuid}`);
  expect(decodeEntityReplyId(id)).toEqual({ kind, entityId: uuid });
  expect(parseOptionReplyId(id)).toBeNull();
});
it.each(['BOT:CODE:invalid', 'BOT:UNKNOWN:'+uuid, 'BOT:CODE:'+uuid+':x', 'BOT:menu:option', 'BOT:ACC:LOGIN:'+uuid, 'BOT:CODE:'+ '😀'.repeat(100), 'CODE:'+uuid])('rejects malformed or unregistered %s', id => {
  expect(decodeEntityReplyId(id)).toBeNull();
});
it('refuses invalid entity encoding and preserves legacy option decoding', () => {
  expect(() => encodeEntityReplyId({ kind: 'CODE', entityId: 'x'.repeat(300) })).toThrow('Invalid entity');
  expect(parseOptionReplyId('BOT:menu:codigo')).toEqual({ nodeId: 'menu', optionId: 'codigo' });
  expect(parseOptionReplyId('BOT:'+ '😀'.repeat(100))).toBeNull();
});
