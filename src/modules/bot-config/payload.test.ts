import { describe, expect, it } from 'vitest';
import type { BotNode } from '@/types/bot';
import { defaultDefinition } from './defaults';
import { buildNodeMessage, optionReplyId, parseOptionReplyId, resolveOption } from './payload';

const node = (patch: Partial<BotNode>): BotNode => ({
  id: 'n1', name: 'N', kind: 'text', body: 'hola', options: [], ...patch,
});

describe('optionReplyId / parseOptionReplyId', () => {
  it('es ida y vuelta', () => {
    const id = optionReplyId('menu', 'codigo');
    expect(id).toBe('BOT:menu:codigo');
    expect(parseOptionReplyId(id)).toEqual({ nodeId: 'menu', optionId: 'codigo' });
  });
  it('acepta ids en el largo maximo (menor de 200)', () => {
    const nodeId = `a${'b'.repeat(31)}`;
    const optionId = `c${'d'.repeat(31)}`;
    const id = optionReplyId(nodeId, optionId);
    expect(id.length).toBeLessThanOrEqual(200);
    expect(parseOptionReplyId(id)).toEqual({ nodeId, optionId });
  });
  it.each([
    '', 'BOT:', 'BOT:menu', 'BOT:menu:', 'BOT::x', 'BOT:Menu:x', 'BOT:menu:X', 'bot:menu:x',
    'BOT:ACC:LOGIN:123e4567-e89b-12d3-a456-426614174000', 'BOT:menu:x:y', 'BOT:1menu:x', 'BOT:m:x',
    'BOT:menu:x\n', ' BOT:menu:x', 'BOT:menu:x ', `BOT:${'a'.repeat(33)}:x`, `BOT:menu:${'a'.repeat(33)}`,
    `BOT:menu:${'a'.repeat(300)}`, 'BOT:NETFLIX', '<script>',
  ])('rechaza %j sin lanzar', (input) => {
    expect(parseOptionReplyId(input)).toBeNull();
  });
  it('rechaza valores que no son texto', () => {
    expect(parseOptionReplyId(undefined as unknown as string)).toBeNull();
  });
});

describe('buildNodeMessage', () => {
  it('texto y nodos sin opciones validas se envian como texto', () => {
    expect(buildNodeMessage(node({}))).toEqual({ kind: 'text', text: 'hola' });
    expect(buildNodeMessage(node({ kind: 'buttons' }))).toEqual({ kind: 'text', text: 'hola' });
    expect(buildNodeMessage(node({ kind: 'list' }))).toEqual({ kind: 'text', text: 'hola' });
    expect(buildNodeMessage(node({ kind: 'action', body: '' }))).toEqual({ kind: 'text', text: '' });
  });
  it('botones con ids de respuesta', () => {
    const message = buildNodeMessage(node({ kind: 'buttons', options: [{ id: 'a', title: 'Uno', next: 'x' }] }));
    expect(message).toEqual({ kind: 'buttons', body: 'hola', buttons: [{ id: 'BOT:n1:a', title: 'Uno' }] });
  });
  it('recorta a los limites de WhatsApp', () => {
    const options = Array.from({ length: 5 }, (_, i) => ({ id: `o${i}`, title: 'T'.repeat(30), next: 'x' }));
    const message = buildNodeMessage(node({ kind: 'buttons', body: 'b'.repeat(2000), options }));
    expect(message.kind).toBe('buttons');
    if (message.kind === 'buttons') {
      expect(message.body.length).toBe(1024);
      expect(message.buttons).toHaveLength(3);
      expect(message.buttons[0].title.length).toBe(20);
    }
  });
  it('lista con descripcion opcional y recortes', () => {
    const options = Array.from({ length: 12 }, (_, i) => ({
      id: `o${i}`, title: 'T'.repeat(30), next: 'x', ...(i === 0 ? { description: 'D'.repeat(100) } : {}),
    }));
    const message = buildNodeMessage(node({ kind: 'list', listButtonLabel: 'L'.repeat(30), options }));
    expect(message.kind).toBe('list');
    if (message.kind === 'list') {
      expect(message.rows).toHaveLength(10);
      expect(message.buttonLabel.length).toBe(20);
      expect(message.rows[0].title.length).toBe(24);
      expect(message.rows[0].description?.length).toBe(72);
      expect('description' in message.rows[1]).toBe(false);
    }
  });
  it('lista sin etiqueta usa cadena vacia', () => {
    const message = buildNodeMessage(node({ kind: 'list', options: [{ id: 'a', title: 'A', next: 'x' }] }));
    expect(message).toMatchObject({ kind: 'list', buttonLabel: '' });
  });
  it('no parte un par sustituto al recortar', () => {
    const emoji = '😀';
    const message = buildNodeMessage(node({ body: `${'a'.repeat(1023)}${emoji}` }));
    expect(message).toEqual({ kind: 'text', text: 'a'.repeat(1023) });
    const exact = buildNodeMessage(node({ body: `${'a'.repeat(1022)}${emoji}` }));
    expect(exact).toEqual({ kind: 'text', text: `${'a'.repeat(1022)}${emoji}` });
  });
});

describe('resolveOption', () => {
  const def = defaultDefinition();
  it('resuelve nodo, opcion y destino', () => {
    const resolved = resolveOption(def, 'menu', 'codigo');
    expect(resolved?.node.id).toBe('menu');
    expect(resolved?.option.id).toBe('codigo');
    expect(resolved?.target.id).toBe('netflix');
  });
  it('devuelve null si algo no existe', () => {
    expect(resolveOption(def, 'nada', 'codigo')).toBeNull();
    expect(resolveOption(def, 'menu', 'nada')).toBeNull();
    const dangling = { ...def, nodes: def.nodes.filter((n) => n.id !== 'netflix') };
    expect(resolveOption(dangling, 'menu', 'codigo')).toBeNull();
  });
});
