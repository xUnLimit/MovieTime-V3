import { describe, expect, it } from 'vitest';
import type { BotNode } from '@/types/bot';
import { kindLabel } from './CompactNodeCard';
import { optionLabel } from './option-label';

const text = (after: BotNode['after'], title = '', any = false): BotNode => ({
  id: 'aviso', name: 'Aviso', kind: 'text', body: 'Hola', after, options: [{ id: 'r', title, next: 'menu', ...(any ? { any: true } : {}) }],
});

describe('optionLabel', () => {
  it('un texto que continúa solo no tiene botón', () => {
    expect(optionLabel(text({ mode: 'continue' }), text({ mode: 'continue' }).options[0])).toBe('Continúa');
  });

  it('en un texto que espera, la salida sin palabras es «cualquier otra respuesta»', () => {
    const waiting = text({ mode: 'wait', hours: 12 }, '', true);
    expect(optionLabel(waiting, waiting.options[0])).toBe('Cualquier otra respuesta');
    const blank = text({ mode: 'wait', hours: 12 });
    expect(optionLabel(blank, blank.options[0])).toBe('Respuesta sin palabras');
    expect(optionLabel(waiting, { id: 'si', title: 'sí, claro', next: 'menu' })).toBe('sí, claro');
  });

  it('en botones y listas es el título de la opción', () => {
    const buttons: BotNode = { id: 'menu', name: 'Menú', kind: 'buttons', body: 'x', options: [{ id: 'a', title: 'Comprar', next: 'x' }] };
    expect(optionLabel(buttons, buttons.options[0])).toBe('Comprar');
  });
});

describe('kindLabel', () => {
  it('distingue el texto final del que continúa o espera', () => {
    expect(kindLabel({ ...text(undefined), options: [] })).toBe('Texto');
    expect(kindLabel(text({ mode: 'continue' }))).toBe('Texto · continúa solo');
    expect(kindLabel(text({ mode: 'wait', hours: 6 }))).toBe('Texto · espera la respuesta');
  });
});
