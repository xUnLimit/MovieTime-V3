import { describe, expect, it } from 'vitest';
import type { BotNode } from '@/types/bot';
import { answerWords, matchTextAnswer } from './answers';

const waiting = (options: [string, string][], after: BotNode['after'] = { mode: 'wait', hours: 12 }): BotNode => ({
  id: 'pregunta', name: 'Pregunta', kind: 'text', body: '¿Quieres continuar?', after,
  options: options.map(([title, next], index) => ({ id: `r${index}`, title, next, ...(title === '' ? { any: true } : {}) })),
});

describe('answerWords', () => {
  it('separa por comas y quita acentos, mayúsculas y espacios de más', () => {
    expect(answerWords(' Sí,  CLARO ,, ok  vale ')).toEqual(['si', 'claro', 'ok vale']);
    expect(answerWords('')).toEqual([]);
  });
});

describe('matchTextAnswer', () => {
  const node = waiting([['sí, claro', 'gracias'], ['no', 'adios'], ['quiero hablar con alguien', 'soporte'], ['', 'menu']]);
  const next = (text: string) => matchTextAnswer(node, text)?.next ?? null;

  it('coincide con una palabra completa sin importar acentos ni mayúsculas', () => {
    expect(next('SI')).toBe('gracias');
    expect(next('Sí, por favor')).toBe('gracias');
    expect(next('claro que sí')).toBe('gracias');
    expect(next('No')).toBe('adios');
  });

  it('no confunde una palabra con parte de otra', () => {
    expect(next('nostalgia')).toBe('menu');
    expect(next('sin duda')).toBe('menu');
  });

  it('una frase de varias palabras debe aparecer completa', () => {
    expect(next('Hola, quiero hablar con alguien ya')).toBe('soporte');
    expect(next('quiero hablar')).toBe('menu');
  });

  it('gana la primera salida que coincide, en el orden del editor', () => {
    expect(next('no, claro')).toBe('gracias');
  });

  it('sin coincidencia usa «cualquier otra respuesta» y, si no hay, ninguna', () => {
    expect(next('tal vez')).toBe('menu');
    const strict = waiting([['sí', 'gracias']]);
    expect(matchTextAnswer(strict, 'tal vez')).toBeNull();
  });

  it('ignora lo que no tiene letras ni números y los nodos que no esperan respuesta', () => {
    expect(matchTextAnswer(node, '   ')).toBeNull();
    expect(matchTextAnswer(node, '😀')).toBeNull();
    expect(matchTextAnswer(waiting([['sí', 'a']], { mode: 'continue' }), 'sí')).toBeNull();
    expect(matchTextAnswer({ ...waiting([['sí', 'a']]), after: undefined }, 'sí')).toBeNull();
    expect(matchTextAnswer({ ...node, kind: 'buttons' }, 'sí')).toBeNull();
  });
});
